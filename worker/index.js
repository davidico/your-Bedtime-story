// Worker: /api/* pasa por handleApi; todo lo demás son los assets estáticos del export de Next.
import { handleApi } from './api.js';
import Anthropic from '@anthropic-ai/sdk';
import { mockGenerateFigure, createFigureGenerator, createWorkersAIGenerator } from './figure-ai.js';

// Generador de Claude: uno por isolate, creado al generar la primera figura (no antes), así ni las pruebas
// ni MOCK_AI ni las peticiones rechazadas tocan el SDK. Si la llamada falla, generate da null (502),
// y si algo lanzara aquí, handleApi también lo trata como fallo de generación. Tiempo máximo 10 s (en ms) y sin
// reintentos: el navegador abandona a los 8 s y no queremos seguir pagando por peticiones abandonadas.
let claudeGenerate;
const generateWithClaude = (env, word) =>
  (claudeGenerate ??= createFigureGenerator({ client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 10_000, maxRetries: 0 }) }))(word);

// Workers AI (gratis, binding AI): tarda 12–43 s por figura, más que los 8 s que espera el navegador.
// No pasa nada: handleApi entrega la generación a ctx.waitUntil, que sigue viva ~30 s después de que el
// navegador corte; la figura queda en KV y la siguiente mención es un acierto de caché. Lo que tarde más de
// ~8 + 30 s se cancela (no se guarda; la siguiente mención lo vuelve a intentar y gasta otro hueco del tope diario).
const generateWithWorkersAI = (env, word) =>
  createWorkersAIGenerator({ ai: env.AI, ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}) })(word);

/** Elige el generador: MOCK_AI=1 → simulado; clave de Anthropic → Claude; binding AI → Workers AI; si no, null (502). */
export function pickGenerator(env) {
  if (env.MOCK_AI === '1') return mockGenerateFigure;
  if (env.ANTHROPIC_API_KEY) return word => generateWithClaude(env, word);
  if (env.AI) return word => generateWithWorkersAI(env, word);
  return async () => null;
}

async function fetch(request, env, ctx) {
  if (new URL(request.url).pathname.startsWith('/api/')) return handleApi(request, env, { generate: pickGenerator(env) }, ctx);
  return env.ASSETS.fetch(request);
}

export default { fetch };
