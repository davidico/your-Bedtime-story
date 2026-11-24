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
