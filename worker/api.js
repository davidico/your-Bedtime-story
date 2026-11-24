// POST /api/figure (spec §5.2, §5.8, §5.9): controles en orden fijo, lista negra, caché en KV y tope diario.
// Privacidad: nunca se registra el cuerpo (ni concepto ni palabra). En KV solo figuras, alias, negativos y el contador.
import { sanitizeFigure, normalizeConcept, isValidConcept, figureKey, aliasKey } from '../lib/figure-format.js';
import { isBuiltinKey } from '../lib/figures.js';
import { isBlocked } from './blocklist.js';

const MAX_BODY = 2048, NEG_TTL = 2592000, COUNT_TTL = 172800, DEFAULT_CAP = 300;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});
const list = s => (typeof s === 'string' ? s.split(',').map(x => x.trim()).filter(Boolean) : null);
// Minúsculas y sin tildes, sin singularizar (la palabra que ve el modelo).
const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
// Respuesta pública: la figura solo viaja si se dibuja.
const reply = f => json(f.status === 'ok' ? { status: 'ok', key: f.canonical, figure: f } : { status: f.status, key: f.canonical });
const negative = concept => ({ status: 'blocked', canonical: concept, band: 'ground', size: 120, layer: 1, main: 'none', prims: [] });
// Escritura de caché que no tumba la respuesta: si KV falla, se devuelve el resultado igualmente.
const safePut = async (kv, ...args) => { try { await kv.put(...args); } catch { /* caché opcional */ } };

// Lee el cuerpo por trozos y corta en cuanto pasa de MAX_BODY (sirve también sin Content-Length). null = demasiado grande.
async function readBody(request) {
  if (!request.body) return '';
  const reader = request.body.getReader(), dec = new TextDecoder();
  let total = 0, text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) { try { await reader.cancel(); } catch { /* nada */ } return null; }
    text += dec.decode(value, { stream: true });
  }
  return text + dec.decode();
}

async function readFig(kv, key) {
  try { const v = await kv.get(key, 'json'); return v ? sanitizeFigure(v) : null; } catch { return null; }
}
// Guarda la figura bajo su canónico; los negativos caducan a los 30 días, los positivos no.
const putFig = (kv, f) => safePut(kv, figureKey(f.canonical), JSON.stringify(f), f.status === 'ok' || f.status === 'builtin' ? undefined : { expirationTtl: NEG_TTL });

// Clave de FIG hecha a mano para un canónico del modelo ('Árbol', 'perros' → 'arbol', 'perro'), o null.
const builtinOf = c => [plain(c), normalizeConcept(c)].find(isBuiltinKey) || null;

/** Atiende /api/*. `deps.generate(word)` devuelve la salida cruda del modelo (o null).
 *  `ctx.waitUntil` (opcional) deja terminar generación y guardado aunque el navegador ya se haya ido (aborta a los 8 s). */
export async function handleApi(request, env, { generate }, ctx) {
  if (request.method !== 'POST') return json({ status: 'error' }, 405, { Allow: 'POST' });
  if (new URL(request.url).pathname !== '/api/figure') return json({ status: 'error' }, 404);
  // 2. Origen permitido (si hay lista).
  const origins = list(env.ALLOWED_ORIGINS); // vacía = sin comprobar
  if (origins?.length && !origins.includes(request.headers.get('Origin'))) return json({ status: 'error' }, 403);
  // 3. Tamaño: primero la cabecera, luego los bytes reales.
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return json({ status: 'error' }, 413);
  const text = await readBody(request);
  if (text === null) return json({ status: 'error' }, 413);
  // 4. Código de familia.
  const code = request.headers.get('X-Family-Code') || '';
  if (!code || !(list(env.FAMILY_CODES) || []).includes(code)) return json({ status: 'error' }, 401);
  // 5. Límite por minuto (código + IP). Sin binding solo se sigue con MOCK_AI=1 (desarrollo local); si no, 503.
  if (!env.FIGURE_LIMITER) { if (env.MOCK_AI !== '1') return json({ status: 'error' }, 503, { 'Retry-After': '60' }); }
  else {
    const ip = request.headers.get('CF-Connecting-IP') || '';
    const { success } = await env.FIGURE_LIMITER.limit({ key: `${code}:${ip}` });
    if (!success) return json({ status: 'error' }, 429, { 'Retry-After': '60' });
  }
  // 6. Validación: JSON con concepto válido. La palabra original solo se acepta si se normaliza al mismo concepto
  // (si no, una familia podría escribir alias o negativos bajo conceptos ajenos); si no, se usa el concepto.
  let body;
  try { body = JSON.parse(text); } catch { return json({ status: 'error' }, 400); }
  if (!body || typeof body !== 'object' || !isValidConcept(body.concept)) return json({ status: 'error' }, 400);
  const concept = normalizeConcept(body.concept);
  const w = typeof body.word === 'string' ? plain(body.word) : '';
  const word = isValidConcept(w) && normalizeConcept(w) === concept ? w : concept;
  const kv = env.FIGURES;
  // 7. Lista negra: blocked sin llamar al modelo y sin escribir en KV (mirarla es gratis; así no se gasta cuota de escrituras).
  if (isBlocked(concept)) return json({ status: 'blocked', key: concept });
  // 8. Caché: alias → figura.
  const canon = (await kv.get(aliasKey(concept)).catch(() => null)) || concept;
  const cached = await readFig(kv, figureKey(canon));
  if (cached) return reply(cached);
  // 9. Tope diario global de generaciones.
  const now = new Date(), countKey = `count:fig:${now.toISOString().slice(0, 10)}`;
  const cap = Number(env.DAILY_FIGURE_CAP) > 0 ? Number(env.DAILY_FIGURE_CAP) : DEFAULT_CAP;
  let count;
  try { count = Number(await kv.get(countKey)) || 0; } catch { return json({ status: 'error' }, 503, { 'Retry-After': '60' }); }
  if (count >= cap) {
    const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return json({ status: 'error' }, 429, { 'Retry-After': String(Math.max(1, Math.ceil((midnight - now) / 1000))) });
  }
  // Se reserva el hueco ANTES de generar: si KV no deja escribir, no se genera (el tope nunca falla abierto).
  // Contador aproximado: leer y escribir no es atómico (spec §5.9); dos peticiones a la vez pueden contar una.
  try { await kv.put(countKey, String(count + 1), { expirationTtl: COUNT_TTL }); }
  catch { return json({ status: 'error' }, 503, { 'Retry-After': '60' }); }
  // 10–12. Generar, sanear y guardar; bajo waitUntil, para que una figura lenta ya pagada quede en caché.
  const work = generateAndStore(kv, concept, word, generate);
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work.catch(() => {}));
  const fig = await work;
  if (!fig) return json({ status: 'error' }, 502);
  // 13. Respuesta.
  return reply(fig);
}

async function generateAndStore(kv, concept, word, generate) {
  // 10. Generar y sanear. La llamada ya cuenta para el tope aunque falle (ya ha costado).
  let fig = null;
  try { fig = sanitizeFigure(await generate(word)); } catch { fig = null; }
  if (!fig) return null;
  const own = fig.status === 'ok' || fig.status === 'builtin' ? builtinOf(fig.canonical) : null;
  if (own) fig = { ...fig, status: 'builtin', canonical: own, main: 'none', prims: [] }; // nunca una 2.ª versión de una figura de mano (A4)
  else if (fig.status === 'builtin') return null; // builtin con una clave que no es de FIG
  else if (fig.status === 'ok') {
    // El canónico del modelo se normaliza como un concepto; si no vale, se usa el pedido.
    const c = normalizeConcept(fig.canonical);
    fig = { ...fig, canonical: isValidConcept(c) ? c : concept };
    if (isBlocked(fig.canonical)) fig = negative(concept);
  } else fig = { ...fig, canonical: concept }; // negativos: solo bajo lo pedido, nunca tapan otra palabra
  // 11. Positivo con otro canónico: se guarda bajo el canónico (si ya había figura, manda la guardada: no se regeneran)
  // y 12. alias del pedido al canónico. Un negativo ajeno bajo el canónico no se sirve: la figura queda solo bajo lo pedido.
  if (fig.canonical !== concept && own) { // builtin: siempre bajo su clave de FIG (pisa un negativo viejo sin sentido)
    await putFig(kv, fig); await safePut(kv, aliasKey(concept), fig.canonical); return fig;
  }
  if (fig.canonical !== concept) {
    const existing = await readFig(kv, figureKey(fig.canonical));
    if (existing && existing.status !== 'ok' && existing.status !== 'builtin') fig = { ...fig, canonical: concept };
    else {
      if (existing) fig = existing; else await putFig(kv, fig);
      await safePut(kv, aliasKey(concept), fig.canonical);
      return fig;
    }
  }
  await putFig(kv, fig);
  return fig;
}
