// De punta a punta sin red: voz (tokens) → director → cliente IA → handleApi con el generador simulado → escena.
import { createDirector } from '@/lib/director';
import { Scene } from '@/lib/scene';
import { tokens } from '@/lib/vocab';
import { FIG } from '@/lib/figures';
import { createAI } from '@/lib/ai';
import { handleApi } from '../worker/api.js';
import { mockGenerateFigure } from '../worker/figure-ai.js';
import { memStorage } from './helpers.js';

function fakeKV() {
  const map = new Map();
  return { map, async get(k, type) { const v = map.has(k) ? map.get(k) : null; return v !== null && type === 'json' ? JSON.parse(v) : v; }, async put(k, v) { map.set(k, String(v)); } };
}
function world(code) {
  const env = { FIGURES: fakeKV(), FIGURE_LIMITER: { limit: async () => ({ success: true }) }, FAMILY_CODES: 'abc', DAILY_FIGURE_CAP: '300' };
  let generated = 0, requests = 0;
  // 'humo': el simulado contesta not_drawable con otro canónico ('nada'), como haría un modelo despistado
  const generate = async w => { generated++; return mockGenerateFigure(w === 'humo' ? 'nada' : w); };
  const fetchImpl = (url, init) => { requests++; return handleApi(new Request('https://w.example' + url, init), env, { generate }); };
  const storage = memStorage(code ? { 'ys:code': code } : {});
  const ai = createAI({ fetchImpl, storage });
  const scene = new Scene(), d = createDirector({ scene, ai });
  const say = text => d.onEvents(tokens(text).filter(t => t.kind !== 'none' || t.gap));
  return { env, ai, scene, say, storage, stats: () => ({ generated, requests }) };
}
const live = (scene, k) => scene.items.filter(i => i.key === k && !i.fadeAt);

test('e2e: elefante se genera y se dibuja; "humo" se desvanece; la segunda vez sale de L1', async () => {
  const w = world('abc');
  w.say('un elefante y un humo junto a un gato');
  expect(w.scene.items.filter(i => i.pending)).toHaveLength(2);
  await vi.waitFor(() => expect(live(w.scene, 'g:elefante')).toHaveLength(1));
  await vi.waitFor(() => expect(w.scene.items.some(i => i.pending && !i.fadeAt)).toBe(false));
  expect(FIG['g:elefante']).toBeTruthy(); expect(w.env.FIGURES.map.has('fig:v1:elefante')).toBe(true);
  expect(w.env.FIGURES.map.has('fig:v1:humo')).toBe(true); expect(w.env.FIGURES.map.has('fig:v1:nada')).toBe(false);
  expect(w.stats()).toEqual({ generated: 2, requests: 2 });
  w.say('el elefante'); w.say('otro elefante'); w.say('un humo');
  await vi.waitFor(() => expect(live(w.scene, 'g:elefante')).toHaveLength(2));
  expect(w.stats()).toEqual({ generated: 2, requests: 2 });
});
test('e2e: código que no vale → se marca, no se borra, nada se dibuja y no hay más red', async () => {
  const w = world('mal'); const seen = []; w.ai.subscribe(s => seen.push(s));
  expect(w.ai.codeStatus()).toBe('ok');
  w.say('un elefante');
  await vi.waitFor(() => expect(w.ai.codeStatus()).toBe('rejected'));
  await vi.waitFor(() => expect(w.scene.items.every(i => i.fadeAt)).toBe(true));
  expect(seen).toEqual(['rejected']); expect(w.storage.data['ys:code']).toBe('mal'); expect(w.ai.getCode()).toBe('mal');
  w.say('una jirafa'); expect(w.scene.items.filter(i => !i.fadeAt)).toHaveLength(0);
  expect(w.stats().requests).toBe(1);
  w.ai.setCode('abc'); expect(w.ai.codeStatus()).toBe('ok'); expect(w.ai.enabled()).toBe(true);
});
test('e2e: sin código ni caché, la app es la de siempre: sin pendientes ni red', () => {
  const w = world('');
  w.say('un elefante sobre la casa'); w.say('un gato');
  expect(w.scene.items.map(i => i.key)).toEqual(['casa', 'gato']); expect(w.stats().requests).toBe(0);
  expect(w.ai.codeStatus()).toBe('none');
});
