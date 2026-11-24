// Formato de figura generada (contrato IA ↔ motor, spec §5.4). Módulo puro: lo usan el navegador,
// el Worker y los scripts de Node, así que nada de APIs del navegador y el import lleva extensión.
import { P, PALETTE_KEYS, circ, ell, rect, S, L, dot } from './figures.js';

export const FORMAT_VERSION = 'v1';
const STATUSES = ['ok', 'builtin', 'not_drawable', 'blocked'], BANDS = ['sky', 'ground', 'water'];
const TYPES = ['poly', 'line', 'circle', 'ellipse', 'rect', 'dot'];

// Esquema para output_config.format: todo obligatorio, sin minimum/maximum (los rangos se aplican al sanear).
export const FIGURE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status', 'canonical', 'band', 'size', 'layer', 'main', 'prims'],
  properties: {
    status: { enum: STATUSES },
    canonical: { type: 'string' },
    band: { enum: BANDS },
    size: { type: 'integer' },
    layer: { enum: [0, 1, 2] },
    main: { enum: ['none', ...PALETTE_KEYS] },
    prims: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['t', 'n', 'color'],
      properties: {
        t: { enum: TYPES },
        n: { type: 'array', items: { type: 'number' } },
        color: { enum: ['ink', ...PALETTE_KEYS] },
      } } },
  },
};

const MAX_PRIMS = 16, MAX_PTS = 24;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const r2 = v => Math.round(v * 100) / 100;
// Papel de cada número de n: 'x', 'y' o 'r' (radio). poly/line/rect son pares x,y.
const ROLES = { circle: ['x', 'y', 'r'], dot: ['x', 'y', 'r'], ellipse: ['x', 'y', 'rx', 'ry'] };
const roles = p => ROLES[p.t] || p.n.map((_, i) => (i % 2 ? 'y' : 'x'));
const okLen = (t, len) => ROLES[t] ? len === ROLES[t].length
  : t === 'rect' ? len === 4 : len % 2 === 0 && len >= 4 && len <= MAX_PTS * 2;

function cleanPrim(p) {
  if (!p || typeof p !== 'object' || !TYPES.includes(p.t) || !Array.isArray(p.n)) return null;
  if (!(p.color === 'ink' || PALETTE_KEYS.includes(p.color))) return null;
  if (!okLen(p.t, p.n.length) || !p.n.every(v => typeof v === 'number' && Number.isFinite(v))) return null;
  const rs = roles(p);
  return { t: p.t, n: p.n.map((v, i) => (rs[i][0] === 'r' ? clamp(v, 0.5, 50) : clamp(v, 0, 100))), color: p.color };
}

// Caja ocupada por las formas de alto nivel (los círculos y elipses cuentan con su radio).
function bbox(prims) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const { t, n } of prims) {
    if (t === 'circle' || t === 'dot') { add(n[0] - n[2], n[1] - n[2]); add(n[0] + n[2], n[1] + n[2]); }
    else if (t === 'ellipse') { add(n[0] - n[2], n[1] - n[3]); add(n[0] + n[2], n[1] + n[3]); }
    else for (let i = 0; i < n.length; i += 2) add(n[i], n[i + 1]);
  }
  return { x0, y0, x1, y1 };
}
const mapPrims = (prims, f) => prims.map(p => { const rs = roles(p); return { ...p, n: p.n.map((v, i) => f(v, rs[i][0])) }; });

// Autoajuste en banda ground: si la caja mide < 40 de alto se escala hasta ~80 alrededor de su centro
// (sin pasar de 100 de ancho), y después se desplaza en vertical para que el punto más bajo toque y=100.
function fitGround(prims) {
  let b = bbox(prims);
  const h = b.y1 - b.y0, w = b.x1 - b.x0;
  if (h < 40) {
    const k = Math.max(1, Math.min(80 / Math.max(h, 1), w > 0 ? 100 / w : Infinity));
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    prims = mapPrims(prims, (v, r) => (r === 'x' ? cx + (v - cx) * k : r === 'y' ? cy + (v - cy) * k : clamp(v * k, 0.5, 50)));
    b = bbox(prims);
    const dx = b.x0 < 0 ? -b.x0 : b.x1 > 100 ? 100 - b.x1 : 0;
    if (dx) prims = mapPrims(prims, (v, r) => (r === 'x' ? v + dx : v));
  }
  const dy = 100 - bbox(prims).y1;
  return mapPrims(prims, (v, r) => (r === 'y' ? clamp(v + dy, 0, 100) : r === 'x' ? clamp(v, 0, 100) : v));
}

/** Sanea la salida del modelo. Devuelve la figura limpia, o null si no sirve (no se cachea). */
export function sanitizeFigure(raw) {
  if (!raw || typeof raw !== 'object' || !STATUSES.includes(raw.status)) return null;
  const canonical = typeof raw.canonical === 'string' ? raw.canonical.trim().toLowerCase().slice(0, 40) : '';
  if (!canonical) return null;
  const band = BANDS.includes(raw.band) ? raw.band : 'ground';
  const size = Math.round(clamp(Number.isFinite(raw.size) ? raw.size : 120, 40, 400));
  let layer = [0, 1, 2].includes(raw.layer) ? raw.layer : 1;
  if (layer === 0 && size < 250) layer = 1;
  const main = PALETTE_KEYS.includes(raw.main) ? raw.main : 'none';
  const base = { status: raw.status, canonical, band, size, layer, main, prims: [] };
  if (raw.status !== 'ok') return base;
  let prims = (Array.isArray(raw.prims) ? raw.prims : []).map(cleanPrim).filter(Boolean).slice(0, MAX_PRIMS);
  if (prims.length < 2 || !prims.some(p => p.t !== 'line' && p.t !== 'dot')) return null;
  if (band === 'ground') prims = fitGround(prims);
  return { ...base, prims: mapPrims(prims, r2) };
}

const pairs = n => Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i], n[2 * i + 1]]);
function expandPrim({ t, n, color }) {
  const fill = P[color];
  if (t === 'poly') return S(pairs(n), fill);
  if (t === 'circle') return S(circ(n[0], n[1], n[2]), fill);
  if (t === 'ellipse') return S(ell(n[0], n[1], n[2], n[3]), fill);
  if (t === 'rect') return S(rect(n[0], n[1], n[2], n[3]), fill);
  if (t === 'line') return L(pairs(n), color === 'ink' ? undefined : fill);
  return dot(n[0], n[1], n[2]);
}

/** Convierte una figura saneada en una definición como las de FIG. */
export function expandFigure(fig) {
  return { band: fig.band, size: fig.size, layer: fig.layer, main: fig.main, draw: () => fig.prims.map(expandPrim) };
}

// Conceptos: minúsculas y sin tildes como norm() de vocab.js, y singular ingenuo palabra a palabra.
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const VOWEL = /[aeiou]/;
function singular(w) {
  if (w.length <= 3) return w;
  if (w.endsWith('ces')) return w.slice(0, -3) + 'z';
  if (w.endsWith('es') && !VOWEL.test(w[w.length - 3])) return w.slice(0, -2);
  if (w.endsWith('s') && VOWEL.test(w[w.length - 2])) return w.slice(0, -1);
  return w;
}
export const normalizeConcept = text => norm(String(text)).replace(/[^a-zñ ]+/g, ' ').split(/\s+/).filter(Boolean).map(singular).join(' ');

/** Concepto aceptable: 2–40 caracteres de letras, ñ y espacios; máximo 3 palabras tras normalizar. */
export function isValidConcept(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 2 || t.length > 40 || !/^[a-zñáéíóúü ]+$/i.test(t)) return false;
  const c = normalizeConcept(t);
  return c.length >= 2 && c.split(' ').length <= 3;
}

export const figureKey = concept => `fig:${FORMAT_VERSION}:${concept}`;
export const aliasKey = concept => `alias:${FORMAT_VERSION}:${concept}`;
