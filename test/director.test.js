import { createDirector } from '@/lib/director';
import { Scene } from '@/lib/scene';
import { tokens } from '@/lib/vocab';
import { FIG } from '@/lib/figures';
import { createAI } from '@/lib/ai';
import { fakeAI, fakeFetch, memStorage, flush, PANDA } from './helpers.js';

test('director: dos pandas seguidos, una petición, dos figuras resueltas', async () => {
  const scene = new Scene();
  const { fetchImpl, calls } = fakeFetch({ status: 'ok', key: 'panda', figure: PANDA });
  const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  const d = createDirector({ scene, ai });
  expect(FIG['g:panda']).toBeUndefined(); // la registra el cliente IA, no la prueba
  d.onEvents(tokens('un panda')); d.onEvents(tokens('otro panda').filter(t => t.kind !== 'none'));
  await flush(); expect(scene.items.filter(i => i.key === 'g:panda')).toHaveLength(2); expect(calls()).toBe(1);
});
test('director: pasa concepto normalizado, palabra original y plural', async () => {
  const scene = new Scene(); const ai = fakeAI({ tigr: { status: 'builtin', key: 'gato' } });
  createDirector({ scene, ai }).onEvents(tokens('dos tigres'));
  expect(ai.asked).toEqual([{ concept: 'tigr', word: 'tigres' }]);
  expect(scene.items.filter(i => i.pending)).toHaveLength(2);
  await flush(); expect(scene.items.filter(i => i.key === 'gato')).toHaveLength(2);
});
test('director: sin IA, el desconocido no deja rastro y lo conocido sigue', () => {
  const scene = new Scene(); const ai = fakeAI({}, { enabled: false }); const d = createDirector({ scene, ai });
  d.onEvents(tokens('un panda y un gato').filter(t => t.kind !== 'none'));
  expect(scene.items.map(i => i.key)).toEqual(['gato']); expect(ai.asked).toHaveLength(0);
});
test('director: cualquier resultado no ok quita el pendiente en silencio', async () => {
  for (const r of [{ status: 'not_drawable' }, { status: 'blocked' }, { status: 'error' }]) {
    const scene = new Scene(); createDirector({ scene, ai: fakeAI({ panda: r }) }).onEvents(tokens('un panda'));
    const [it] = scene.items; expect(it.pending).toBe(true);
    await flush(); expect(it.fadeAt).toBeTruthy(); expect(scene.items.some(i => i.key === 'g:panda')).toBe(false);
  }
  const scene = new Scene();
  createDirector({ scene, ai: { enabled: () => true, figure: () => Promise.reject(new Error('x')) } }).onEvents(tokens('un panda'));
  await flush(); expect(scene.items[0].fadeAt).toBeTruthy();
});
test('director: el resto de tokens van a la escena (y "none" no)', () => {
  const scene = new Scene(); const seen = []; const orig = scene.handle.bind(scene);
  scene.handle = ev => { seen.push(ev.kind); return orig(ev); };
  createDirector({ scene, ai: fakeAI({}) }).onEvents(tokens('un gato sobre la casa'));
  expect(seen).not.toContain('none'); expect(seen).toContain('noun'); expect(seen).toContain('prep');
  expect(scene.items.map(i => i.key).sort()).toEqual(['casa', 'gato']);
});
