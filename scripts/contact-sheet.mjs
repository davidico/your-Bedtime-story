// Hoja de contacto de figuras: genera una figura por concepto, mide la latencia y escribe una página HTML
// autocontenida con cada figura en SVG, para revisar el estilo y medir p50/p95.
// Uso: npm run contact-sheet -- [--model claude-haiku-5-5] [--out contact-sheet.html]
// Con ANTHROPIC_API_KEY llama a Claude en serie (la primera llamada escribe la caché y las demás la leen);
// sin ella usa la simulación y lo dice en la cabecera.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createFigureGenerator, mockGenerateFigure } from '../worker/figure-ai.js';
import { sanitizeFigure, expandFigure, normalizeConcept } from '../lib/figure-format.js';
import { FIG, P, isBuiltinKey } from '../lib/figures.js';

function parseArgs(argv) {
  const opts = { model: 'claude-haiku-5-5', out: 'contact-sheet.html' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], eq = a.indexOf('=');
    const [name, inline] = eq > 0 ? [a.slice(0, eq), a.slice(eq + 1)] : [a, undefined];
    if (name !== '--model' && name !== '--out') throw new Error(`Argumento desconocido: ${a}`);
    const value = inline ?? argv[++i];
    if (!value) throw new Error(`Falta el valor de ${name}`);
    opts[name.slice(2)] = value;
  }
  return opts;
}

const readConcepts = () => readFileSync(new URL('./concepts.txt', import.meta.url), 'utf8')
  .split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

// Percentil por rango más cercano sobre los milisegundos medidos.
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p / 100 * sorted.length) - 1))];
}

const plain = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ptsAttr = pts => pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join(' ');

// Primitivas expandidas → SVG: rellenas con su color y contorno de tinta; líneas con su color o tinta;
// los puntos (nostroke) solo se rellenan. Caja de 100×100 con el suelo en y=100.
function primsToSvg(prims, band) {
  const body = prims.map(p => {
    const pts = ptsAttr(p.pts);
    if (!p.closed) return `<polyline points="${pts}" fill="none" stroke="${p.color || P.ink}"/>`;
    return `<polygon points="${pts}" fill="${p.fill || 'none'}" stroke="${p.nostroke ? 'none' : P.ink}"/>`;
  }).join('');
  const ground = band === 'ground' ? `<line x1="-4" y1="100" x2="104" y2="100" class="g"/>` : '';
  return `<svg viewBox="-4 -4 108 108" role="img">${ground}<g stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const usage = { calls: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, input_tokens: 0, output_tokens: 0 };
  let generate;
  if (apiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, timeout: 10_000, maxRetries: 0 });
    generate = createFigureGenerator({ client, model: opts.model, onUsage: u => {
      usage.calls++;
      for (const k of ['cache_read_input_tokens', 'cache_creation_input_tokens', 'input_tokens', 'output_tokens']) usage[k] += u?.[k] || 0;
    } });
  } else {
    generate = mockGenerateFigure;
  }
  const label = apiKey ? opts.model : 'SIMULACIÓN';

  const rows = [];
  // En serie a propósito: medir latencia y caché sin que las llamadas compitan entre sí.
  for (const label of readConcepts()) {
    // Como en producción: el navegador manda la palabra sin tildes ni mayúsculas (sin singularizar) y el Worker
    // se la pasa al modelo; el concepto normalizado (singular) es la clave de caché.
    const word = plain(label), concept = normalizeConcept(label);
    const t0 = performance.now();
    const raw = await generate(word);
    const ms = Math.round(performance.now() - t0);
    const fig = raw ? sanitizeFigure(raw) : null;
    const status = !raw ? 'error' : !fig ? 'invalid' : fig.status;
    rows.push({ label, concept, ms, status, fig });
    console.log(`${label.padEnd(16)} ${String(ms).padStart(6)} ms  ${status}${fig && fig.canonical !== concept ? ` → ${fig.canonical}` : ''}`);
  }

  const lat = rows.map(r => r.ms);
  const count = s => rows.filter(r => r.status === s).length;
  const stats = {
    p50: percentile(lat, 50), p95: percentile(lat, 95),
    ok: count('ok'), builtin: count('builtin'), blocked: count('blocked'), not_drawable: count('not_drawable'),
    invalid: count('invalid') + count('error'), error: count('error'),
  };
  const html = renderPage({ label, simulated: !apiKey, rows, stats, usage });
  const out = resolve(opts.out);
  writeFileSync(out, html);
  console.log(`\n${label} · p50 ${stats.p50} ms · p95 ${stats.p95} ms · ok ${stats.ok} · builtin ${stats.builtin} · blocked ${stats.blocked} · not_drawable ${stats.not_drawable} · inválidas ${stats.invalid}` +
    ` · cache_read_input_tokens ${usage.cache_read_input_tokens}\nHoja escrita en ${out}`);
}

const EMPTY = { blocked: 'bloqueada', not_drawable: 'no se dibuja', invalid: 'inválida', error: 'sin respuesta' };
const empty = text => `<div class="empty">${esc(text)}</div>`;
// Una tarjeta que no se puede pintar no tumba la hoja entera.
function cardSvg({ status, fig }) {
  try {
    const own = fig && plain(fig.canonical);
    if (status === 'ok') return primsToSvg(expandFigure(fig).draw(), fig.band);
    if (status === 'builtin' && isBuiltinKey(own)) return primsToSvg(FIG[own].draw(), FIG[own].band);
    return empty(EMPTY[status] || status);
  } catch { return empty('no se pudo pintar'); }
}

function renderPage({ label, simulated, rows, stats, usage }) {
  const cards = rows.map(r => {
    const canon = r.fig && r.fig.canonical !== r.concept ? ` <span class="canon">→ ${esc(r.fig.canonical)}</span>` : '';
    const meta = r.fig && r.status === 'ok' ? `<span>${esc(r.fig.band)} · ${r.fig.size} · ${r.fig.prims.length} prims</span>` : '';
    return `<figure class="card s-${esc(r.status)}">${cardSvg(r)}<figcaption><b>${esc(r.label)}</b>${canon}` +
      `<span class="row"><span class="st">${esc(r.status)}</span><span>${r.ms} ms</span></span>${meta}</figcaption></figure>`;
  }).join('\n');
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hoja de contacto de figuras</title>
<style>
:root { --ink: ${P.ink}; --paper: #fbfaf6; --card: #ffffff; --muted: #77737f; --line: #e4e0d8; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font: 15px/1.4 system-ui, -apple-system, sans-serif; }
header { padding: 16px; border-bottom: 1px solid var(--line); background: var(--card); }
h1 { margin: 0 0 4px; font-size: 20px; }
.model { display: inline-block; padding: 2px 8px; border-radius: 6px; background: #eef2f7; font-weight: 600; }
.model.sim { background: #fde7c4; color: #7a4a00; }
.stats { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 0 0; padding: 0; list-style: none; }
.stats b { font-variant-numeric: tabular-nums; }
.note { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
main { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 16px; }
.card { margin: 0; background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 8px; }
.card svg, .empty { display: block; width: 100%; aspect-ratio: 1; }
.card .g { stroke: var(--line); stroke-width: 1; }
.empty { display: grid; place-items: center; color: var(--muted); background: #f3f1ec; border-radius: 6px; font-size: 13px; }
figcaption { display: grid; gap: 2px; margin-top: 6px; font-size: 13px; }
figcaption b { font-size: 15px; }
figcaption span { color: var(--muted); }
.canon { color: var(--muted); font-weight: normal; }
.row { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; }
.st { font-weight: 600; }
.s-ok .st { color: #3f7d4e; } .s-builtin .st { color: #4f8fd6; }
.s-blocked .st, .s-invalid .st, .s-error .st { color: #c0392b; } .s-not_drawable .st { color: #8a6d00; }
</style></head><body>
<header>
<h1>Hoja de contacto de figuras</h1>
<span class="model${simulated ? ' sim' : ''}">${esc(label)}</span>
<ul class="stats">
<li>p50 <b>${stats.p50 ?? '–'} ms</b></li><li>p95 <b>${stats.p95 ?? '–'} ms</b></li>
<li>ok <b>${stats.ok}</b></li><li>builtin <b>${stats.builtin}</b></li>
<li>blocked <b>${stats.blocked}</b></li><li>not_drawable <b>${stats.not_drawable}</b></li>
<li>inválidas <b>${stats.invalid}</b>${stats.error ? ` (sin respuesta ${stats.error})` : ''}</li>
<li>cache_read_input_tokens <b>${usage.cache_read_input_tokens}</b></li>
</ul>
<p class="note">${rows.length} conceptos en serie · ${esc(when)}${simulated ? ' · sin ANTHROPIC_API_KEY: figuras simuladas, la latencia no es real' : ` · ${usage.calls} respuestas con usage`}</p>
</header>
<main>
${cards}
</main>
</body></html>
`;
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
