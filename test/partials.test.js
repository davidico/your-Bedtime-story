import { tokens } from '@/lib/vocab';
import { splitHeld, createHolds } from '@/lib/partials';
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

describe('createHolds (temporizador del retenido)', () => {
  let out, h;
  const words = () => out.flat().map(t => t.word ?? t.key);
  beforeEach(() => { vi.useFakeTimers(); out = []; h = createHolds(evs => out.push(evs)); });
  afterEach(() => vi.useRealTimers());

  test('una reescritura cancela el temporizador y emite la palabra actual', () => {
    h.feed(0, tokens('un pan'), false);
    vi.advanceTimersByTime(400);
    h.feed(0, tokens('un panda'), false);
    vi.advanceTimersByTime(400);
    expect(out).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(words()).toEqual(['panda']);
  });
  test('los conocidos salen al instante', () => {
    h.feed(0, tokens('un gato'), false);
    expect(words()).toEqual(['gato']);
  });
  test('emite una sola vez: temporizador y luego otra palabra', () => {
    h.feed(0, tokens('un panda'), false);
    vi.advanceTimersByTime(600);
    h.feed(0, tokens('un panda sobre'), false);
    vi.runAllTimers();
    expect(words()).toEqual(['panda', 'sobre']);
  });
  test('emite una sola vez: temporizador y luego final', () => {
    h.feed(0, tokens('un panda'), false);
    vi.advanceTimersByTime(600);
    h.feed(0, tokens('un panda'), true);
    vi.runAllTimers();
    expect(words()).toEqual(['panda']);
  });
  test('otra palabra o el final confirman sin esperar', () => {
    h.feed(0, tokens('un pan'), false);
    h.feed(0, tokens('un panda de'), false);
    h.feed(1, tokens('una jirafa'), true);
    expect(words()).toEqual(['panda', 'jirafa']);
    vi.runAllTimers();
    expect(words()).toEqual(['panda', 'jirafa']);
  });
  test('clear (pausa) descarta el retenido; reset olvida lo visto', () => {
    h.feed(0, tokens('un panda'), false);
    h.clear();
    vi.runAllTimers();
    expect(out).toEqual([]);
    h.feed(0, tokens('un gato'), false);
    h.reset();
    h.feed(0, tokens('un gato'), false);
    expect(words()).toEqual(['gato', 'gato']);
  });
});

// --- revisión final ---
test('un desconocido retenido y luego seguido de un sustantivo: el sustantivo sale igual', () => {
  vi.useFakeTimers(); const out = []; const h = createHolds(evs => out.push(evs));
  h.feed(0, tokens('el fierisimo'), false); vi.advanceTimersByTime(600);
  h.feed(0, tokens('el fierisimo lobo'), true);
  expect(out.flat().map(t => t.word ?? t.key ?? t.kind)).toEqual(['art', 'fierisimo', 'lobo']);
  vi.useRealTimers();
});
