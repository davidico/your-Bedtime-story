import { tokens } from '@/lib/vocab';
import { splitHeld } from '@/lib/partials';
test('retiene el desconocido final de un parcial', () => {
  expect(splitHeld(tokens('un pan'), false)).toMatchObject({ ready: [], held: { word: 'pan' } });
  expect(splitHeld(tokens('un panda de'), false).ready.map(t => t.word)).toEqual(['panda']);
  expect(splitHeld(tokens('un panda'), true)).toMatchObject({ held: null, ready: [{ word: 'panda' }] });
  expect(splitHeld(tokens('un gato'), false).ready[0].key).toBe('gato');
});
test('solo retiene si el desconocido es el último token', () => {
  expect(splitHeld(tokens('un pan y'), false).held).toBeNull();
  expect(splitHeld(tokens('un gato sobre un pan'), false)).toMatchObject({ ready: [{ key: 'gato' }, { kind: 'prep' }], held: { word: 'pan', pos: 4 } });
  expect(splitHeld([], false)).toEqual({ ready: [], held: null });
});
