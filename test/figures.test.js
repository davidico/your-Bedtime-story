import { FIG, P, PALETTE_KEYS, registerFigure, tintPrims } from '@/lib/figures';
test('toda figura local tiene main válido', () => {
  for (const [k, f] of Object.entries(FIG)) expect(['none', ...PALETTE_KEYS]).toContain(f.main);
  expect(FIG.gato.main).toBe('grey'); expect(FIG.perro.main).toBe('lbrown'); expect(FIG.casa.main).toBe('sand');
});
test('tintPrims cambia solo el color main', () => {
  const out = tintPrims(FIG.gato.draw(), 'grey', 'red');
  expect(out.some(p => p.fill === P.red)).toBe(true);
  expect(out.some(p => p.fill === P.grey)).toBe(false);
  expect(tintPrims(FIG.gato.draw(), 'grey', null)).toEqual(FIG.gato.draw());
});
test('registerFigure exige prefijo g:', () => {
  registerFigure('g:panda', { band: 'ground', size: 140, layer: 2, main: 'white', draw: () => [] });
  expect(FIG['g:panda'].size).toBe(140);
  expect(() => registerFigure('panda', {})).toThrow();
});
