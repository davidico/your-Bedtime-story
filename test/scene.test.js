import { Scene } from '@/lib/scene';
import { FIG, P, S, circ, registerFigure, GROUND } from '@/lib/figures';

afterEach(() => vi.restoreAllMocks());

test('pendiente, relación y sustitución en su sitio', () => {
  const s = new Scene();
  s.handle({ kind: 'noun', key: 'casa' });
  s.handle({ kind: 'prep', key: 'sobre' });
  const [id] = s.addPending('panda', { plural: false });
  const it = s.items.find(i => i.id === id);
  expect(it.pending).toBe(true); expect(it.noun).toBe('panda');
  registerFigure('g:panda', { band: 'ground', size: 140, layer: 2, main: 'white', draw: () => [S(circ(50, 60, 30), P.white), S(circ(50, 30, 15), P.white)] });
  const x = it.x; s.resolvePending([id], 'g:panda');
  expect(it.pending).toBe(false); expect(it.key).toBe('g:panda'); expect(it.x).toBe(x);
});
test('color tras un pendiente y plural', () => {
  const s = new Scene();
  const ids = s.addPending('vaca', { plural: true }); expect(ids).toHaveLength(2);
  s.handle({ kind: 'color', key: 'red' });
  expect(s.items.find(i => i.id === ids[1]).tint).toBe('red');
});
test('"el panda" reutiliza el existente', () => {
  const s = new Scene(); s.addPending('panda', { plural: false });
  s.handle({ kind: 'art' }); expect(s.addPending('panda', { plural: false })).toEqual([]);
});
test('ids no se reutilizan tras clear (respuesta tardía no resucita)', () => {
  const s = new Scene(); const [a] = s.addPending('panda', { plural: false });
  s.clear(); const [b] = s.addPending('vaca', { plural: false });
  expect(b).not.toBe(a); s.resolvePending([a], 'gato'); expect(s.items).toHaveLength(1); expect(s.items[0].key).toBe('__pending');
});

// --- pruebas adicionales ---
test('figura interna __pending: suelo, 110, sin color principal', () => {
  expect(FIG.__pending.band).toBe('ground'); expect(FIG.__pending.size).toBe(110); expect(FIG.__pending.main).toBe('none');
  const prims = FIG.__pending.draw(); expect(prims.length).toBeGreaterThanOrEqual(2);
  for (const p of prims) { expect(p.fill).toBeFalsy(); expect(p.color).toBe(P.grey); }
});
test('sustantivos locales llevan id, noun = clave, tint y pending', () => {
  const s = new Scene(); s.handle({ kind: 'noun', key: 'gato' }); s.handle({ kind: 'noun', key: 'pez' });
  const ids = s.items.map(i => i.id); expect(new Set(ids).size).toBe(ids.length);
  for (const i of s.items) { expect(i.id).toMatch(/^e\d+$/); expect(i.tint).toBeNull(); expect(i.pending).toBe(false); }
  expect(s.items[0].noun).toBe('gato'); expect(s.items.find(i => i.key === 'mar').noun).toBe('mar');
});
test('color dentro de 3 s tiñe last y cambia el relleno principal', () => {
  const s = new Scene(); s.handle({ kind: 'noun', key: 'gato' });
  s.handle({ kind: 'color', key: 'red' });
  expect(s.last.tint).toBe('red');
  expect(s.last.prims.some(p => p.fill === P.red)).toBe(true); expect(s.last.prims.some(p => p.fill === P.grey)).toBe(false);
});
test('color pasados 3 s queda pendiente para el siguiente sustantivo', () => {
  const s = new Scene(); let t = 1000; vi.spyOn(performance, 'now').mockImplementation(() => t);
  s.handle({ kind: 'noun', key: 'gato' }); const gato = s.last;
  t += 3500; s.handle({ kind: 'color', key: 'blue' });
  expect(gato.tint).toBeNull();
  s.handle({ kind: 'noun', key: 'perro' }); expect(s.last.tint).toBe('blue');
  const [id] = s.addPending('panda', { plural: false }); expect(s.items.find(i => i.id === id).tint).toBeNull();
});
test('color antes del pendiente se aplica al pendiente y se conserva al resolver', () => {
  const s = new Scene(); s.handle({ kind: 'color', key: 'green' });
  const [id] = s.addPending('gatito', { plural: false }); const it = s.items.find(i => i.id === id);
  expect(it.tint).toBe('green'); s.resolvePending([id], 'gato');
  expect(it.tint).toBe('green'); expect(it.prims.some(p => p.fill === P.green)).toBe(true);
});
test('resolver conserva la escala pedida', () => {
  const s = new Scene(); s.handle({ kind: 'adj', scale: 2 });
  const [id] = s.addPending('panda', { plural: false }); const it = s.items.find(i => i.id === id);
  const ratio = it.s / (FIG.__pending.size / 100);
  s.resolvePending([id], 'gato'); expect(it.s).toBeCloseTo(FIG.gato.size / 100 * ratio);
});
test('resolver a cielo o agua recalcula banda y base; el agua trae el mar', () => {
  const s = new Scene(); const [a, b] = [s.addPending('cometa', { plural: false })[0], s.addPending('ballena', { plural: false })[0]];
  const A = s.items.find(i => i.id === a), B = s.items.find(i => i.id === b);
  s.resolvePending([a], 'sol'); expect(A.band).toBe('sky'); expect(A.base).toBeLessThan(GROUND - 100);
  s.resolvePending([b], 'barco'); expect(B.band).toBe('water'); expect(B.base).toBe(648);
  expect(s.items.some(i => i.key === 'mar')).toBe(true);
});
test('resolver vuelve a animar (born = now)', () => {
  const s = new Scene(); let t = 1000; vi.spyOn(performance, 'now').mockImplementation(() => t);
  const [id] = s.addPending('panda', { plural: false }); t = 5000; s.resolvePending([id], 'gato');
  expect(s.items.find(i => i.id === id).born).toBe(5000);
});
test('dropPending desvanece y frame lo elimina a los 400 ms', () => {
  const s = new Scene(); let t = 1000; vi.spyOn(performance, 'now').mockImplementation(() => t);
  const [id] = s.addPending('panda', { plural: false }); s.dropPending([id, 'e999']);
  const it = s.items.find(i => i.id === id); expect(it.fadeAt).toBe(1000);
  s.sweep(1300); expect(s.items).toContain(it);
  s.sweep(1400); expect(s.items).not.toContain(it); expect(s.last).toBeNull();
});
test('el límite de 18 elementos móviles cuenta los pendientes', () => {
  const s = new Scene();
  for (let i = 0; i < 25; i++) s.addPending('cosa' + i, { plural: false });
  expect(s.items.filter(i => i.layer >= 0)).toHaveLength(18);
});
test('handle ignora tipos desconocidos (unk no crea nada)', () => {
  const s = new Scene(); s.handle({ kind: 'unk', word: 'panda', plural: false, pos: 0 }); s.handle({ kind: 'zzz' });
  expect(s.items).toHaveLength(0);
});
