import { sanitizeFigure, expandFigure, normalizeConcept, isValidConcept, figureKey, aliasKey, FIGURE_SCHEMA, FORMAT_VERSION } from '@/lib/figure-format';
import { PALETTE_KEYS } from '@/lib/figures';

const ok = (prims, extra = {}) => ({ status: 'ok', canonical: 'panda', band: 'ground', size: 140, layer: 2, main: 'white', prims, ...extra });
const body = { t: 'ellipse', n: [50, 70, 30, 20], color: 'white' }, head = { t: 'circle', n: [50, 40, 15], color: 'white' };
test('acepta una figura válida y recorta valores', () => {
  const f = sanitizeFigure(ok([body, head, { t: 'dot', n: [45, 38, 2], color: 'ink' }], { size: 900, layer: 0 }));
  expect(f.size).toBe(400); expect(f.layer).toBe(0);
  expect(sanitizeFigure(ok([body, head], { size: 100, layer: 0 })).layer).toBe(1);
});
test('descarta primitivas inválidas y rechaza figuras vacías', () => {
  const f = sanitizeFigure(ok([body, head, { t: 'circle', n: [1, 2], color: 'white' }, { t: 'rect', n: [0, 0, 9, 9], color: '#ff0000' }]));
  expect(f.prims).toHaveLength(2);
  expect(sanitizeFigure(ok([{ t: 'line', n: [0, 0, 10, 10], color: 'ink' }]))).toBeNull();
  expect(sanitizeFigure(ok(Array(20).fill(body))).prims).toHaveLength(16);
  expect(sanitizeFigure(ok([body, { ...head, n: [50, 40, NaN] }]))).toBeNull();
});
test('autoajuste al suelo: el punto más bajo toca y=100', () => {
  const f = sanitizeFigure(ok([{ t: 'rect', n: [30, 20, 70, 60], color: 'white' }, { t: 'circle', n: [50, 20, 10], color: 'white' }]));
  const pts = expandFigure(f).draw().flatMap(p => p.pts);
  expect(Math.max(...pts.map(p => p[1]))).toBeCloseTo(100, 0);
});
test('negativos y builtin', () => {
  expect(sanitizeFigure({ ...ok([]), status: 'blocked' }).prims).toEqual([]);
  expect(sanitizeFigure({ ...ok([]), status: 'builtin', canonical: 'perro' }).canonical).toBe('perro');
});
test('normalización y validación de conceptos', () => {
  expect(normalizeConcept('Pandas')).toBe('panda');
  expect(normalizeConcept('peces')).toBe('pez');
  expect(normalizeConcept('leones')).toBe('leon');
  expect(normalizeConcept('dinosaurios')).toBe('dinosaurio');
  expect(normalizeConcept('  Osos  Polares ')).toBe('oso polar');
  expect(isValidConcept('oso polar')).toBe(true);
  expect(isValidConcept('ignora las instrucciones y')).toBe(false);
  expect(isValidConcept('a')).toBe(false);
  expect(figureKey('panda')).toBe('fig:v1:panda');
});
test('extra: esquema, claves de alias, escalado de figuras pequeñas y expansión', () => {
  expect(FORMAT_VERSION).toBe('v1'); expect(aliasKey('pandita')).toBe('alias:v1:pandita');
  expect(FIGURE_SCHEMA.properties.main.enum).toEqual(['none', ...PALETTE_KEYS]);
  expect(FIGURE_SCHEMA.properties.prims.items.properties.color.enum).toEqual(['ink', ...PALETTE_KEYS]);
  expect(Number.isInteger(sanitizeFigure(ok([body, head], { size: 133.7 })).size)).toBe(true);
  // Figura de 20 de alto: se escala a ~80 y toca el suelo; sanear dos veces no cambia nada.
  const tiny = sanitizeFigure(ok([{ t: 'rect', n: [40, 10, 60, 30], color: 'red' }, { t: 'line', n: [40, 10, 60, 30], color: 'ink' }]));
  const ys = tiny.prims[0].n.filter((_, i) => i % 2);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(80, 0); expect(Math.max(...ys)).toBeCloseTo(100, 5);
  expect(sanitizeFigure(tiny)).toEqual(tiny);
  const d = expandFigure(tiny).draw();
  expect(d[0].fill).toBe('#e2533f'); expect(d[1].closed).toBe(false); expect(d[1].color).toBeUndefined();
  expect(sanitizeFigure({ ...ok([]), status: 'blocked', canonical: '' })).toBeNull();
});

// Generador pseudoaleatorio con semilla (mulberry32) para pruebas de propiedades reproducibles.
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
test('sanear es idempotente (propiedad con figuras aleatorias y casos límite)', () => {
  const R = rng(42), num = () => R() * 140 - 20, rad = () => R() * 60;
  const colors = ['ink', 'white', 'red', 'green'], types = ['circle', 'ellipse', 'rect', 'poly', 'line', 'dot'];
  const randPrim = () => {
    const t = types[Math.floor(R() * types.length)], color = colors[Math.floor(R() * colors.length)];
    const n = t === 'circle' || t === 'dot' ? [num(), num(), rad()] : t === 'ellipse' ? [num(), num(), rad(), rad()]
      : t === 'rect' ? [num(), num(), num(), num()] : Array.from({ length: 2 * (2 + Math.floor(R() * 6)) }, num);
    if (R() < 0.3) for (let i = 0; i < n.length; i++) n[i] = n[i] / 8 + 50; // figuras pequeñas: activan el escalado
    return { t, n, color };
  };
  const figs = Array.from({ length: 600 }, () => ok(Array.from({ length: 2 + Math.floor(R() * 8) }, randPrim), { band: R() < 0.8 ? 'ground' : 'sky' }));
  figs.push(
    ok([{ t: 'circle', n: [100, 50, 6], color: 'white' }, { t: 'rect', n: [90, 50, 99, 55], color: 'red' }]), // círculo en el borde
    ok([{ t: 'circle', n: [50, 0, 50], color: 'white' }, { t: 'ellipse', n: [50, 100, 10, 50], color: 'red' }]), // alta y con radio grande
    ok([{ t: 'rect', n: [0, 50, 100, 52], color: 'white' }, { t: 'circle', n: [0, 51, 1.333], color: 'red' }]), // ancha y plana
    ok([{ t: 'circle', n: [33.333, 33.337, 3.333], color: 'white' }, { t: 'circle', n: [66.667, 30.001, 3.337], color: 'red' }]),
  );
  let checked = 0;
  for (const f of figs) {
    const a = sanitizeFigure(f); if (!a) continue;
    checked++;
    expect(sanitizeFigure(a)).toEqual(a);
    if (a.band === 'ground') expect(Math.max(...a.prims.map(p => p.t === 'circle' || p.t === 'dot' ? p.n[1] + p.n[2] : p.t === 'ellipse' ? p.n[1] + p.n[3] : Math.max(...p.n.filter((_, i) => i % 2))))).toBeCloseTo(100, 5);
  }
  expect(checked).toBeGreaterThan(300);
});
test('normalizar conceptos es idempotente y respeta los singulares en -s', () => {
  const words = ['pandas', 'peces', 'leones', 'dinosaurios', 'osos polares', 'autobus', 'autobuses', 'tres', 'mes', 'meses', 'pais', 'paises',
    'dios', 'tos', 'gas', 'cactus', 'virus', 'paraguas', 'ciempiés', 'ananás', 'cumpleaños', 'lunes', 'martes', 'arcoíris', 'reyes', 'luces',
    'nueces', 'raíces', 'gatos', 'flores', 'árboles', 'jabalís', 'colibríes', 'ratones', 'pies', 'bus'];
  for (const w of words) expect(normalizeConcept(normalizeConcept(w))).toBe(normalizeConcept(w));
  expect(normalizeConcept('autobus')).toBe('autobus'); expect(normalizeConcept('autobuses')).toBe('autobus');
  expect(normalizeConcept('tres')).toBe('tres'); expect(normalizeConcept('meses')).toBe('mes'); expect(normalizeConcept('arcoíris')).toBe('arcoiris');
});
