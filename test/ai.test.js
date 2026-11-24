import { createAI } from '@/lib/ai';
import { FIG } from '@/lib/figures';
import { fakeFetch, fakeStatus, memStorage, PANDA } from './helpers.js';

afterEach(() => vi.useRealTimers());

test('una sola petición para el mismo concepto en vuelo; segunda vez desde L1', async () => {
  const { fetchImpl, calls, sent } = fakeFetch({ status: 'ok', key: 'panda', figure: PANDA });
  const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }), apiBase: 'https://w.example' });
  const [a, b] = await Promise.all([ai.figure('panda', 'panda'), ai.figure('panda', 'panda')]);
  expect(calls()).toBe(1); expect(a).toEqual({ status: 'ok', key: 'g:panda' }); expect(b).toEqual(a);
  expect(FIG['g:panda'].draw().length).toBe(3);
  await ai.figure('panda'); expect(calls()).toBe(1);
  // petición: POST JSON con código de familia, concepto y palabra original
  const [{ url, init, body }] = sent;
  expect(url).toBe('https://w.example/api/figure'); expect(init.method).toBe('POST');
  expect(init.headers['X-Family-Code']).toBe('abc'); expect(body).toEqual({ concept: 'panda', word: 'panda' });
});
test('la palabra original viaja junto al concepto; la clave de caché es el concepto', async () => {
  const { fetchImpl, calls, sent } = fakeFetch({ status: 'not_drawable', key: 'tigr' });
  const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  await ai.figure('tigr', 'tigres'); await ai.figure('tigr', 'tigre');
  expect(sent[0].body).toEqual({ concept: 'tigr', word: 'tigres' }); expect(calls()).toBe(1);
});
test('L1 persiste en storage y otra instancia la reutiliza sin red', async () => {
  const storage = memStorage({ 'ys:code': 'abc' });
  const { fetchImpl } = fakeFetch({ status: 'ok', key: 'panda', figure: PANDA });
  await createAI({ fetchImpl, storage }).figure('pandita', 'pandita');
  expect(JSON.parse(storage.data['ys:fig:v1']).pandita).toBeTruthy();
  delete FIG['g:panda'];
  const off = fakeStatus(500);
  const ai2 = createAI({ fetchImpl: off, storage });
  expect(await ai2.figure('pandita')).toEqual({ status: 'ok', key: 'g:panda' });
  expect(off.calls).toBe(0); expect(FIG['g:panda']).toBeTruthy(); // se vuelve a registrar desde L1
});
test('429 pausa según Retry-After; 401 marca el código como rechazado sin borrarlo', async () => {
  let t = 0; const ai = createAI({ fetchImpl: fakeStatus(429, { 'Retry-After': '60' }), storage: memStorage({ 'ys:code': 'abc' }), now: () => t });
  expect((await ai.figure('vaca')).status).toBe('error'); expect(ai.enabled()).toBe(false);
  t = 61000; expect(ai.enabled()).toBe(true);
  const storage = memStorage({ 'ys:code': 'abc' });
  const ai2 = createAI({ fetchImpl: fakeStatus(401), storage });
  expect((await ai2.figure('vaca')).status).toBe('error');
  expect(ai2.getCode()).toBe('abc'); expect(ai2.enabled()).toBe(false); expect(storage.data['ys:code']).toBe('abc');
  expect(ai2.codeStatus()).toBe('rejected');
  ai2.setCode('otro'); expect(ai2.codeStatus()).toBe('ok'); expect(ai2.enabled()).toBe(true);
  ai2.setCode(''); expect(ai2.codeStatus()).toBe('none');
});
test('negativos se cachean; error no', async () => {
  const neg = fakeFetch({ status: 'not_drawable', key: 'idea' });
  const ai = createAI({ fetchImpl: neg.fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai.figure('idea')).toEqual({ status: 'not_drawable' });
  expect(await ai.figure('idea')).toEqual({ status: 'not_drawable' }); expect(neg.calls()).toBe(1);
  const blk = fakeFetch({ status: 'blocked', key: 'pistola' });
  const ai2 = createAI({ fetchImpl: blk.fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  await ai2.figure('pistola'); expect(await ai2.figure('pistola')).toEqual({ status: 'blocked' }); expect(blk.calls()).toBe(1);
  const err = fakeStatus(500);
  const ai3 = createAI({ fetchImpl: err, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai3.figure('vaca')).toEqual({ status: 'error' });
  expect(await ai3.figure('vaca')).toEqual({ status: 'error' }); expect(err.calls).toBe(2);
});
test('builtin usa la figura local; si no existe, error', async () => {
  const ai = createAI({ fetchImpl: fakeFetch({ status: 'builtin', key: 'gato' }).fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai.figure('gatito')).toEqual({ status: 'builtin', key: 'gato' });
  const ai2 = createAI({ fetchImpl: fakeFetch({ status: 'builtin', key: 'nada' }).fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai2.figure('nada')).toEqual({ status: 'error' });
});
test('builtin heredado, interno o de fondo → error sin cachear', async () => {
  for (const key of ['constructor', '__proto__', 'toString', '__pending', 'mar']) {
    const f = fakeFetch({ status: 'builtin', key }); const storage = memStorage({ 'ys:code': 'abc' });
    const ai = createAI({ fetchImpl: f.fetchImpl, storage });
    expect(await ai.figure('cosa')).toEqual({ status: 'error' }); await ai.figure('cosa');
    expect(f.calls()).toBe(2); expect(storage.data['ys:fig:v1']).toBeUndefined();
  }
});
test('ok: la clave sale de figure.canonical, no de key', async () => {
  const { fetchImpl } = fakeFetch({ status: 'ok', key: 'otra', figure: { ...PANDA, canonical: 'oso panda' } });
  const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai.figure('panda')).toEqual({ status: 'ok', key: 'g:oso panda' });
  expect(FIG['g:oso panda']).toBeTruthy(); expect(FIG['g:otra']).toBeUndefined();
});
test('entrada envenenada en L1: se descarta y se vuelve a pedir', async () => {
  const bad = { status: 'ok', key: 'vaca', figure: { ...PANDA, canonical: 'vaca', prims: [{ t: 'line', n: [0, 0, 1, 1], color: 'ink' }] } };
  const storage = memStorage({ 'ys:code': 'abc', 'ys:fig:v1': JSON.stringify({ vaca: bad, gato: { status: 'builtin', key: 'constructor' } }) });
  const { fetchImpl, calls } = fakeFetch({ status: 'ok', key: 'vaca', figure: { ...PANDA, canonical: 'vaca' } });
  const ai = createAI({ fetchImpl, storage });
  expect(await ai.figure('vaca')).toEqual({ status: 'ok', key: 'g:vaca' }); expect(calls()).toBe(1);
  expect(JSON.parse(storage.data['ys:fig:v1']).vaca.figure.prims).toHaveLength(3);
  await ai.figure('gato'); expect(calls()).toBe(2); expect(JSON.parse(storage.data['ys:fig:v1']).gato.key).not.toBe('constructor');
});
test('figura inválida o respuesta rara → error sin cachear', async () => {
  const bad = fakeFetch({ status: 'ok', key: 'vaca', figure: { ...PANDA, prims: [] } });
  const ai = createAI({ fetchImpl: bad.fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai.figure('vaca')).toEqual({ status: 'error' }); await ai.figure('vaca'); expect(bad.calls()).toBe(2);
  const ai2 = createAI({ fetchImpl: async () => { throw new Error('sin red'); }, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai2.figure('vaca')).toEqual({ status: 'error' });
});
test('aborta a los 8 s', async () => {
  vi.useFakeTimers();
  const fetchImpl = (url, { signal }) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('abort'))));
  const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  const p = ai.figure('vaca');
  await vi.advanceTimersByTimeAsync(7999); let done = false; p.then(() => { done = true; });
  await Promise.resolve(); expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1); expect(await p).toEqual({ status: 'error' });
});
test('sin código no hay red; setCode lo guarda', async () => {
  const f = fakeStatus(500); const storage = memStorage();
  const ai = createAI({ fetchImpl: f, storage });
  expect(ai.enabled()).toBe(false); expect(await ai.figure('vaca')).toEqual({ status: 'error' }); expect(f.calls).toBe(0);
  ai.setCode(' xyz '); expect(ai.getCode()).toBe('xyz'); expect(storage.data['ys:code']).toBe('xyz'); expect(ai.enabled()).toBe(true);
});
test('storage nulo o que lanza: solo memoria', async () => {
  const boom = { getItem() { throw new Error('privado'); }, setItem() { throw new Error('privado'); }, removeItem() { throw new Error('privado'); } };
  for (const storage of [null, boom]) {
    const { fetchImpl, calls } = fakeFetch({ status: 'ok', key: 'panda', figure: PANDA });
    const ai = createAI({ fetchImpl, storage });
    expect(ai.getCode()).toBe(''); ai.setCode('abc'); expect(ai.enabled()).toBe(true);
    expect(await ai.figure('panda')).toEqual({ status: 'ok', key: 'g:panda' });
    await ai.figure('panda'); expect(calls()).toBe(1);
  }
});
test('L1 con tope de 300: sale lo más antiguo', async () => {
  const storage = memStorage({ 'ys:code': 'abc' });
  const fetchImpl = async (url, { body }) => new Response(JSON.stringify({ status: 'not_drawable', key: JSON.parse(body).concept }), { status: 200 });
  const ai = createAI({ fetchImpl, storage });
  for (let i = 0; i < 301; i++) await ai.figure('c' + 'abcdefghijklmnopqrstuvwxyz'[i % 26] + i);
  const l1 = JSON.parse(storage.data['ys:fig:v1']);
  expect(Object.keys(l1)).toHaveLength(300); expect(l1.ca0).toBeUndefined(); expect(l1.ca300).toBeUndefined();
});

// --- revisión final ---
test('cached: síncrono, sin red; sirve L1 aunque no haya código', async () => {
  const storage = memStorage({ 'ys:code': 'abc' });
  const { fetchImpl } = fakeFetch({ status: 'not_drawable', key: 'idea' });
  await createAI({ fetchImpl, storage }).figure('idea');
  const f = fakeStatus(500); const ai = createAI({ fetchImpl: f, storage }); ai.setCode('');
  expect(ai.cached('idea')).toEqual({ status: 'not_drawable' }); expect(ai.cached('vaca')).toBeNull();
  expect(await ai.figure('idea')).toEqual({ status: 'not_drawable' }); expect(f.calls).toBe(0);
});
test('ok con canónico de una figura hecha a mano → builtin, sin registrar g:', async () => {
  for (const canonical of ['perro', 'perros', 'Árbol']) {
    const { fetchImpl } = fakeFetch({ status: 'ok', key: canonical, figure: { ...PANDA, canonical } });
    const ai = createAI({ fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
    expect(await ai.figure('cosa')).toEqual({ status: 'builtin', key: canonical === 'Árbol' ? 'arbol' : 'perro' });
  }
  expect(FIG['g:perro']).toBeUndefined(); expect(FIG['g:perros']).toBeUndefined();
  const ai = createAI({ fetchImpl: fakeFetch({ status: 'builtin', key: 'árbol' }).fetchImpl, storage: memStorage({ 'ys:code': 'abc' }) });
  expect(await ai.figure('arbolote')).toEqual({ status: 'builtin', key: 'arbol' });
});
test('subscribe avisa del rechazo una vez y de los cambios de código', async () => {
  const ai = createAI({ fetchImpl: fakeStatus(401), storage: memStorage({ 'ys:code': 'abc' }) }); const seen = [];
  const off = ai.subscribe(s => seen.push(s));
  await ai.figure('vaca'); expect(await ai.figure('oso')).toEqual({ status: 'error' });
  ai.setCode('nuevo'); off(); ai.setCode('');
  expect(seen).toEqual(['rejected', 'ok']);
});
