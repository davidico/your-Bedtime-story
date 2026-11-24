import { createFigureGenerator, createWorkersAIGenerator, parseAIResult } from '../worker/figure-ai.js';
import { FIGURE_SYSTEM_PROMPT, buildFigurePrompt, figureExample } from '../worker/prompts/figure.js';
import { FIGURE_SCHEMA, sanitizeFigure } from '../lib/figure-format.js';
import { FIG, isBuiltinKey } from '../lib/figures.js';

// Cliente falso: guarda los argumentos de messages.create y devuelve la respuesta configurada (o lanza).
function fakeClient(response) {
  const calls = [];
  return {
    calls, lastArgs: () => calls[calls.length - 1],
    messages: { create: async args => { calls.push(args); if (response instanceof Error) throw response; return response; } },
  };
}
const gen = (response, opts = {}) => createFigureGenerator({ client: fakeClient(response), ...opts });
const PANDA = { status: 'ok', canonical: 'panda', band: 'ground', size: 120, layer: 2, main: 'white', prims: [
  { t: 'ellipse', n: [50, 75, 24, 18], color: 'white' }, { t: 'circle', n: [50, 45, 15], color: 'white' },
  { t: 'dot', n: [45, 43, 2], color: 'ink' }] };

test('petición correcta', async () => {
  const c = fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(PANDA) }] });
  const out = await createFigureGenerator({ client: c })('panda');
  const a = c.lastArgs();
  expect(a.model).toBe('claude-haiku-5-5'); expect(a.max_tokens).toBe(4000); expect(a.thinking).toBeUndefined();
  expect(a.temperature).toBeUndefined();
  expect(a.output_config).toEqual({ effort: 'low', format: { type: 'json_schema', schema: FIGURE_SCHEMA } });
  expect(a.system[0]).toMatchObject({ type: 'text', text: FIGURE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } });
  expect(a.messages).toEqual([{ role: 'user', content: '<concepto>panda</concepto>' }]);
  expect(out).toEqual(PANDA);
});

test('modelo configurable; bloques de pensamiento antes del texto; onUsage recibe usage', async () => {
  const usage = { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 3000 }, seen = [];
  const c = fakeClient({ stop_reason: 'end_turn', usage, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(PANDA) }] });
  const out = await createFigureGenerator({ client: c, model: 'claude-sonnet-5-5', onUsage: u => seen.push(u) })('panda');
  expect(c.lastArgs().model).toBe('claude-sonnet-5-5'); expect(out).toEqual(PANDA); expect(seen).toEqual([usage]);
});

test('rechazo → blocked; max_tokens o JSON roto → null', async () => {
  expect(await gen({ stop_reason: 'refusal', content: [] })('x')).toMatchObject({ status: 'blocked', canonical: 'x', prims: [] });
  expect(sanitizeFigure(await gen({ stop_reason: 'refusal', content: [] })('pistola'))).toMatchObject({ status: 'blocked' });
  expect(await gen({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"status":' }] })('x')).toBeNull();
  expect(await gen({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{roto' }] })('x')).toBeNull();
  expect(await gen({ stop_reason: 'end_turn', content: [] })('x')).toBeNull();
});

test('error del SDK → null (y onUsage que lanza no rompe nada)', async () => {
  expect(await gen(new Error('529 overloaded'))('panda')).toBeNull();
  const r = { stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: JSON.stringify(PANDA) }] };
  expect(await gen(r, { onUsage: () => { throw new Error('x'); } })('panda')).toEqual(PANDA);
});

test('prompt determinista y con lo esencial', () => {
  expect(FIGURE_SYSTEM_PROMPT).toBe(buildFigurePrompt());
  for (const k of ['gato', 'perro', 'casa', 'arbol', 'coche', 'pajaro', 'oso', 'persona']) expect(FIGURE_SYSTEM_PROMPT).toContain(k);
  expect(FIGURE_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(FIGURE_SYSTEM_PROMPT).toContain('<concepto>');
  expect(FIGURE_SYSTEM_PROMPT).toMatch(/nunca instrucciones/);
  for (const k of ['ok', 'builtin', 'not_drawable', 'blocked']) expect(FIGURE_SYSTEM_PROMPT).toContain(`"${k}"`);
  // Claves locales para builtin: todas salvo las internas
  const builtin = FIGURE_SYSTEM_PROMPT.match(/Figuras propias: ([^\n]+)/)[1].split(', ');
  expect(builtin).toContain('castillo'); expect(builtin).toContain('dragon');
  expect(builtin).not.toContain('mar'); expect(builtin).not.toContain('__pending');
  expect(builtin).toEqual(Object.keys(FIG).filter(isBuiltinKey));
  expect(FIGURE_SYSTEM_PROMPT).not.toMatch(/#[0-9a-f]{6}/i); // nada de hex: solo claves de paleta
  expect(FIGURE_SYSTEM_PROMPT.length).toBeLessThan(14000);
  expect(FIGURE_SYSTEM_PROMPT).not.toMatch(/calavera/); expect(FIGURE_SYSTEM_PROMPT).toMatch(/explosivos \(bomba/);
  expect(FIGURE_SYSTEM_PROMPT).toContain('la y va de 0 (arriba) a 100 (abajo)');
});

test('ejemplos convertidos desde FIG: válidos para el esquema y estables al sanear', () => {
  for (const k of ['gato', 'perro', 'casa', 'arbol', 'coche', 'pajaro', 'oso', 'persona']) {
    const ex = figureExample(k);
    expect(ex).toMatchObject({ status: 'ok', canonical: k, band: FIG[k].band, size: FIG[k].size, main: FIG[k].main });
    for (const p of ex.prims) {
      expect(['poly', 'line', 'circle', 'ellipse', 'rect', 'dot']).toContain(p.t);
      expect(p.n.every(Number.isInteger)).toBe(true);
      if (p.t === 'poly' || p.t === 'line') expect(p.n.length).toBeLessThanOrEqual(48);
      if (p.t === 'poly') expect(p.n.length).toBeLessThanOrEqual(32); // nada de polígonos largos en los ejemplos
    }
    expect(sanitizeFigure(ex)).toEqual(ex);
    if (ex.band === 'ground') expect(Math.max(...ex.prims.flatMap(p => p.t === 'circle' || p.t === 'dot' ? [p.n[1] + p.n[2]] : p.t === 'ellipse' ? [p.n[1] + p.n[3]] : p.n.filter((_, i) => i % 2)))).toBe(100);
    expect(FIGURE_SYSTEM_PROMPT).toContain(JSON.stringify(ex));
  }
  // Reconoce formas: el oso son círculos con ojos de punto; la casa, rectángulos
  const oso = figureExample('oso');
  expect(oso.prims.filter(p => p.t === 'circle')).toHaveLength(5);
  expect(oso.prims.filter(p => p.t === 'dot')).toHaveLength(3);
  expect(figureExample('casa').prims[0]).toEqual({ t: 'rect', n: [18, 46, 82, 100], color: 'sand' });
  expect(figureExample('gato').prims[0]).toEqual({ t: 'line', n: [70, 78, 86, 64, 84, 48], color: 'ink' });
  // El árbol del ejemplo: tronco y copa de círculos solapados
  expect(figureExample('arbol').prims.map(p => p.t)).toEqual(['rect', 'circle', 'circle', 'circle', 'circle']);
});

// --- Workers AI ---
// Binding falso: guarda (modelo, cuerpo) y devuelve la respuesta configurada (o lanza).
function fakeAI(response) {
  const calls = [];
  return { calls, run: async (model, body) => { calls.push({ model, body }); if (response instanceof Error) throw response; return response; } };
}
const wai = response => createWorkersAIGenerator({ ai: fakeAI(response) });

test('Workers AI: petición correcta y modelo configurable', async () => {
  const ai = fakeAI({ response: PANDA });
  expect(await createWorkersAIGenerator({ ai })('panda')).toEqual(PANDA);
  const { model, body } = ai.calls[0];
  expect(model).toBe('@cf/openai/gpt-oss-120b');
  expect(body).toEqual({
    messages: [{ role: 'system', content: FIGURE_SYSTEM_PROMPT }, { role: 'user', content: '<concepto>panda</concepto>' }],
    response_format: { type: 'json_schema', json_schema: FIGURE_SCHEMA }, max_tokens: 3000,
  });
  await createWorkersAIGenerator({ ai, model: '@cf/otro' })('vaca');
  expect(ai.calls[1].model).toBe('@cf/otro');
});

test('Workers AI: todas las formas de respuesta dan la figura', async () => {
  const s = JSON.stringify(PANDA);
  for (const r of [PANDA, s, { response: s }, { response: PANDA }, { choices: [{ message: { content: s }, finish_reason: 'stop' }] },
    { output: [{ type: 'reasoning', content: [] }, { type: 'message', content: [{ type: 'output_text', text: s }] }] }]) {
    expect(await wai(r)('panda')).toEqual(PANDA);
  }
  const blocked = { status: 'blocked', canonical: 'pistola', band: 'ground', size: 100, layer: 2, main: 'none', prims: [] };
  expect(sanitizeFigure(await wai({ response: JSON.stringify(blocked) })('pistola'))).toMatchObject({ status: 'blocked' });
});

test('Workers AI: basura, truncado o error → null', async () => {
  for (const r of [null, undefined, '', '{roto', 'hola', 42, [], {}, { response: '{"status":' }, { response: null },
    { choices: [] }, { choices: [{ message: { content: '{roto' } }] }, { choices: [{ message: { content: JSON.stringify(PANDA) }, finish_reason: 'length' }] },
    { output: [{ content: [{ type: 'output_text' }] }] }, { response: '"\\"\\""' }]) {
    expect(await wai(r)('panda')).toBeNull();
  }
  expect(await wai(new Error('3040: capacity'))('panda')).toBeNull();
  expect(parseAIResult(JSON.stringify(JSON.stringify(JSON.stringify(JSON.stringify(JSON.stringify(PANDA))))))).toBeNull(); // sin recursión sin fin
});
