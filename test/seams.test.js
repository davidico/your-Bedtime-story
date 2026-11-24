// Costuras: la cadena real tokens → director → Scene (revisión final de la fase 1a).
import { createDirector } from '@/lib/director';
import { Scene } from '@/lib/scene';
import { tokens } from '@/lib/vocab';
import { FIG, P, S, circ, registerFigure } from '@/lib/figures';
import { createAI } from '@/lib/ai';
import { fakeAI, fakeFetch, fakeStatus, memStorage, flush, PANDA } from './helpers.js';

const BLOB = { band: 'ground', size: 160, layer: 2, main: 'grey', draw: () => [S(circ(50, 60, 30), P.grey), S(circ(50, 30, 15), P.grey)] };
// Monta escena + director; say() reparte una frase como hace la app (sin los 'none').
function setup(ai) {
  const scene = new Scene(), d = createDirector({ scene, ai });
  return { scene, say: text => d.onEvents(tokens(text).filter(t => t.kind !== 'none')), keys: k => scene.items.filter(i => i.key === k && !i.fadeAt) };
}

describe('I1: un desconocido entre determinante y sustantivo conocido no se come el estado', () => {
  test('"el feroz lobo" se refiere al lobo que ya está (adjetivo de STOP)', async () => {
    const ai = fakeAI({}); const { say, keys } = setup(ai);
    say('un lobo'); say('el feroz lobo'); await flush();
    expect(keys('lobo')).toHaveLength(1); expect(ai.asked).toHaveLength(0);
  });
  test('desconocido justo antes de un sustantivo conocido: se salta sin pedir nada', async () => {
    const ai = fakeAI({}); const { scene, say, keys } = setup(ai);
    say('un lobo'); say('el fierisimo lobo'); await flush();
    expect(keys('lobo')).toHaveLength(1); expect(ai.asked).toHaveLength(0);
    expect(scene.items.some(i => i.pending)).toBe(false);
  });
  test('"un gato sobre la hermosa casa": una sola casa y el gato encima', async () => {
    const { say, keys } = setup(fakeAI({}));
    say('una casa.'); say('un gato sobre la hermosa casa'); await flush();
    const [casa] = keys('casa'), [gato] = keys('gato');
    expect(keys('casa')).toHaveLength(1); expect(gato.x).toBe(casa.x); expect(gato.rel).toEqual({ to: casa.id, rel: 'sobre' });
  });
  test('pendiente descartado antes del siguiente sustantivo: se restaura determinante y relación', async () => {
    const ai = fakeAI({ gordisim: { status: 'not_drawable' } }); const { say, keys } = setup(ai);
    say('una casa.'); say('un gato sobre la gordisima'); await flush();
    say('casa'); await flush();
    const [casa] = keys('casa'), [gato] = keys('gato');
    expect(keys('casa')).toHaveLength(1); expect(gato.x).toBe(casa.x); expect(gato.rel.to).toBe(casa.id);
  });
  test('pendiente descartado sin nada detrás: el sujeto vuelve a su sitio y sin rel colgante', async () => {
    const { scene, say, keys } = setup(fakeAI({ gordisim: { status: 'not_drawable' } }));
    say('un gato'); const [gato] = keys('gato'); const { x, base, layer, s } = gato;
    say('sobre la gordisima'); expect(gato.rel).toBeTruthy(); await flush();
    expect({ x: gato.x, base: gato.base, layer: gato.layer, s: gato.s }).toEqual({ x, base, layer, s });
    expect(gato.rel).toBeUndefined(); expect(scene.items.filter(i => i.fadeAt)).toHaveLength(1);
  });
  test('"la vio": el determinante vuelve si el pendiente se descarta (como con la IA apagada)', async () => {
    const { scene, say } = setup(fakeAI({ vio: { status: 'not_drawable' } }));
    say('un gato'); say('la vio'); expect(scene.definite).toBe(false); await flush();
    expect(scene.definite).toBe(true);
  });
  test('un pendiente posterior ya consumió el estado: no se restaura', async () => {
    const { scene, say } = setup(fakeAI({ vio: { status: 'not_drawable' } }));
    say('un gato'); say('la vio'); say('un perro'); await flush();
    expect(scene.definite).toBe(false);
  });
});

describe('I2: la escena recuerda el canónico', () => {
  test('"dos elefantes … el elefante": dos elefantes, no tres', async () => {
    registerFigure('g:elefante', BLOB);
    const ai = fakeAI({ elefant: { status: 'ok', key: 'g:elefante' }, elefante: { status: 'ok', key: 'g:elefante' } });
    const { scene, say, keys } = setup(ai);
    say('dos elefantes'); await flush();
    say('el elefante'); await flush();
    expect(keys('g:elefante')).toHaveLength(2); expect(scene.items).toHaveLength(2);
    expect(keys('g:elefante')[0]).toMatchObject({ noun: 'elefante', alias: 'elefant' });
  });
  test('"un pandita … el panda" y "un can … el perro"', async () => {
    registerFigure('g:panda', BLOB);
    const ai = fakeAI({ pandita: { status: 'ok', key: 'g:panda' }, can: { status: 'builtin', key: 'perro' } });
    const { say, keys } = setup(ai);
    say('un pandita'); say('un can'); await flush();
    say('el panda'); say('el perro'); await flush();
    expect(keys('g:panda')).toHaveLength(1); expect(keys('perro')).toHaveLength(1);
    expect(ai.asked.map(a => a.concept)).toEqual(['pandita', 'can']);
  });
});

describe('I3: lo aprendido sigue dibujándose sin red', () => {
  async function learned(fetchAfter) {
    const storage = memStorage({ 'ys:code': 'abc' });
    let impl = fakeFetch({ status: 'ok', key: 'panda', figure: PANDA }).fetchImpl;
    const ai = createAI({ fetchImpl: (...a) => impl(...a), storage, now: () => 0 });
    const { say, keys } = setup(ai);
    say('un panda'); await flush(); expect(keys('g:panda')).toHaveLength(1);
    impl = fetchAfter; return { ai, say, keys };
  }
  test('durante una pausa por 429', async () => {
    const f = fakeStatus(429, { 'Retry-After': '60' }); const { ai, say, keys } = await learned(f);
    say('un oso panda'); say('una vaca'); await flush(); expect(ai.enabled()).toBe(false); expect(f.calls).toBe(1);
    say('otro panda'); say('una jirafa'); await flush();
    expect(keys('g:panda')).toHaveLength(2); expect(f.calls).toBe(1);
  });
  test('tras un 401', async () => {
    const f = fakeStatus(401); const { ai, say, keys } = await learned(f);
    say('una vaca'); await flush(); expect(ai.enabled()).toBe(false);
    say('otro panda'); say('una jirafa'); await flush();
    expect(keys('g:panda')).toHaveLength(2); expect(f.calls).toBe(1);
  });
  test('modo local (sin código ni caché): ni pendientes ni red', async () => {
    const f = fakeStatus(500); const ai = createAI({ fetchImpl: f, storage: memStorage() });
    const { scene, say } = setup(ai);
    say('un gato y una jirafa sobre la casa'); await flush();
    expect(scene.items.some(i => i.pending || i.fadeAt)).toBe(false); expect(f.calls).toBe(0);
    expect(scene.items.map(i => i.key).sort()).toEqual(['casa', 'gato']);
  });
});

test('M1: "un autobús" es uno (singular acabado en s)', () => {
  const ai = fakeAI({}); const { scene, say } = setup(ai);
  say('un autobús'); expect(scene.items.filter(i => i.pending)).toHaveLength(1);
  say('dos ratones'); expect(scene.items.filter(i => i.pending)).toHaveLength(3);
});
test('M3: modo local, "un gato miraba el cielo azul" no tiñe al gato', () => {
  const { say, keys } = setup(fakeAI({}, { enabled: false }));
  say('un gato miraba el cielo azul'); expect(keys('gato')[0].tint).toBeNull();
  say('un perro miraba una jirafa roja'); expect(keys('perro')[0].tint).toBeNull();
});
test('M3: con IA, "el cielo" no se pide (STOP) y no tiñe al gato', () => {
  const ai = fakeAI({}); const { say, keys } = setup(ai);
  say('un gato miraba el cielo azul'); expect(ai.asked).toHaveLength(0); expect(keys('gato')[0].tint).toBeNull();
});
