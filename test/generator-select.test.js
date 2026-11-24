// Elección del generador en worker/index.js: simulado, Claude (con clave) o Workers AI (solo binding AI).
import { vi } from 'vitest';

const create = vi.fn(async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"status":"not_drawable","canonical":"mesa"}' }] }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { constructor(o) { this.opts = o; this.messages = { create }; } } }));
const { pickGenerator } = await import('../worker/index.js');
const { mockGenerateFigure } = await import('../worker/figure-ai.js');

const fakeAI = () => ({ run: vi.fn(async () => ({ response: '{"status":"not_drawable","canonical":"mesa"}' })) });
beforeEach(() => create.mockClear());

test('MOCK_AI=1 → simulado, aunque haya clave y binding', async () => {
  const ai = fakeAI();
  expect(pickGenerator({ MOCK_AI: '1', ANTHROPIC_API_KEY: 'k', AI: ai })).toBe(mockGenerateFigure);
  expect(ai.run).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
});
test('con ANTHROPIC_API_KEY → Claude (aunque haya binding AI)', async () => {
  const ai = fakeAI();
  expect(await pickGenerator({ ANTHROPIC_API_KEY: 'k', AI: ai })('mesa')).toMatchObject({ status: 'not_drawable' });
  expect(create).toHaveBeenCalledTimes(1); expect(ai.run).not.toHaveBeenCalled();
});
test('solo binding AI → Workers AI; AI_MODEL cambia el modelo', async () => {
  const ai = fakeAI();
  expect(await pickGenerator({ AI: ai })('mesa')).toMatchObject({ status: 'not_drawable' });
  expect(ai.run.mock.calls[0][0]).toBe('@cf/openai/gpt-oss-120b');
  await pickGenerator({ AI: ai, AI_MODEL: '@cf/otro/modelo' })('mesa');
  expect(ai.run.mock.calls[1][0]).toBe('@cf/otro/modelo');
  expect(create).not.toHaveBeenCalled();
});
test('sin nada → null (handleApi responde 502)', async () => {
  expect(await pickGenerator({})('mesa')).toBeNull();
  expect(create).not.toHaveBeenCalled();
});
