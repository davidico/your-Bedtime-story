// POST /api/figure (spec §5.2, §5.8, §5.9): controles en orden fijo, lista negra, caché en KV y tope diario.
// Privacidad: nunca se registra el cuerpo (ni concepto ni palabra). En KV solo figuras, alias, negativos y el contador.
import { sanitizeFigure, normalizeConcept, isValidConcept, figureKey, aliasKey } from '../lib/figure-format.js';
import { FIG } from '../lib/figures.js';
import { isBlocked } from './blocklist.js';

const MAX_BODY = 2048, NEG_TTL = 2592000, COUNT_TTL = 172800, DEFAULT_CAP = 300;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});
const list = s => (typeof s === 'string' ? s.split(',').map(x => x.trim()).filter(Boolean) : null);
// Minúsculas y sin tildes, sin singularizar (la palabra que ve el modelo).
const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
// builtin válido: clave propia de FIG, ni interna, ni generada, ni de fondo fijo (misma regla que lib/ai.js).
const isBuiltinKey = k => Object.hasOwn(FIG, k) && !k.startsWith('__') && !k.startsWith('g:') && FIG[k].band !== 'fixed';
// Respuesta pública: la figura solo viaja si se dibuja.
const reply = f => json(f.status === 'ok' ? { status: 'ok', key: f.canonical, figure: f } : { status: f.status, key: f.canonical });
const negative = concept => ({ status: 'blocked', canonical: concept, band: 'ground', size: 120, layer: 1, main: 'none', prims: [] });

async function readFig(kv, key) {
  try { const v = await kv.get(key, 'json'); return v ? sanitizeFigure(v) : null; } catch { return null; }
}
// Guarda la figura bajo su canónico; los negativos caducan a los 30 días, los positivos no.
const putFig = (kv, f) => kv.put(figureKey(f.canonical), JSON.stringify(f), f.status === 'ok' || f.status === 'builtin' ? undefined : { expirationTtl: NEG_TTL });

/** Atiende /api/*. `deps.generate(word)` devuelve la salida cruda del modelo (o null). */
export async function handleApi(request, env, { generate }) {
  if (request.method !== 'POST') return json({ status: 'error' }, 405, { Allow: 'POST' });
  if (new URL(request.url).pathname !== '/api/figure') return json({ status: 'error' }, 404);
  // 2. Origen permitido (si hay lista).
  const origins = list(env.ALLOWED_ORIGINS);
  if (origins && !origins.includes(request.headers.get('Origin'))) return json({ status: 'error' }, 403);
  // 3. Tamaño: primero la cabecera, luego los bytes reales.
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return json({ status: 'error' }, 413);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY) return json({ status: 'error' }, 413);
  // 4. Código de familia.
  const code = request.headers.get('X-Family-Code') || '';
  if (!code || !(list(env.FAMILY_CODES) || []).includes(code)) return json({ status: 'error' }, 401);
  // 5. Límite por minuto (código + IP). Sin binding (desarrollo local) no se limita.
  if (env.FIGURE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const { success } = await env.FIGURE_LIMITER.limit({ key: `${code}:${ip}` });
    if (!success) return json({ status: 'error' }, 429, { 'Retry-After': '60' });
  }
  // 6. Validación: JSON con concepto válido; la palabra original se valida igual o se sustituye por el concepto.
  let body;
  try { body = JSON.parse(text); } catch { return json({ status: 'error' }, 400); }
  if (!body || typeof body !== 'object' || !isValidConcept(body.concept)) return json({ status: 'error' }, 400);
  const concept = normalizeConcept(body.concept);
  const w = typeof body.word === 'string' ? plain(body.word) : '';
  const word = isValidConcept(w) ? w : concept;
  const kv = env.FIGURES;
  // 7. Lista negra: blocked sin llamar al modelo; el negativo se escribe solo si no estaba (ahorra escrituras).
  if (isBlocked(concept) || isBlocked(word)) {
    if (!(await readFig(kv, figureKey(concept)))) await putFig(kv, negative(concept));
    return json({ status: 'blocked', key: concept });
  }
  // 8. Caché: alias → figura.
  const canon = (await kv.get(aliasKey(concept))) || concept;
  const cached = await readFig(kv, figureKey(canon));
  if (cached) return reply(cached);
  // 9. Tope diario global de generaciones.
  const now = new Date(), countKey = `count:fig:${now.toISOString().slice(0, 10)}`;
  const cap = Number(env.DAILY_FIGURE_CAP) > 0 ? Number(env.DAILY_FIGURE_CAP) : DEFAULT_CAP;
  const count = Number(await kv.get(countKey)) || 0;
  if (count >= cap) {
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return json({ status: 'error' }, 429, { 'Retry-After': String(Math.max(1, Math.ceil((midnight - now) / 1000))) });
  }
  // 10. Generar y sanear. La llamada cuenta para el tope aunque falle (ya ha costado).
  let fig = null;
  try { fig = sanitizeFigure(await generate(word)); } catch { fig = null; }
  await kv.put(countKey, String(count + 1), { expirationTtl: COUNT_TTL });
  if (fig && fig.status === 'builtin') { if (!isBuiltinKey(fig.canonical)) fig = null; }
  else if (fig) {
    // El canónico del modelo se normaliza como un concepto; si no vale, se usa el pedido.
    const c = normalizeConcept(fig.canonical);
    fig = { ...fig, canonical: isValidConcept(c) ? c : concept };
    if (fig.status === 'ok' && isBlocked(fig.canonical)) fig = { ...negative(fig.canonical) };
  }
  if (!fig) return json({ status: 'error' }, 502);
  // 11. Guardar bajo el canónico; si ya había figura ahí, manda la guardada (las figuras no se regeneran).
  if (fig.canonical !== concept) {
    const existing = await readFig(kv, figureKey(fig.canonical));
    if (existing) fig = existing; else await putFig(kv, fig);
    // 12. Alias del pedido al canónico.
    await kv.put(aliasKey(concept), fig.canonical);
  } else await putFig(kv, fig);
  // 13. Respuesta.
  return reply(fig);
}
