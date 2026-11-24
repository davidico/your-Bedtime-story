// Worker: /api/* pasa por handleApi; todo lo demás son los assets estáticos del export de Next.
import { handleApi } from './api.js';
import Anthropic from '@anthropic-ai/sdk';
import { mockGenerateFigure, createFigureGenerator } from './figure-ai.js';

// Generador de Claude: uno por isolate, creado al generar la primera figura (no antes), así ni las pruebas
// ni MOCK_AI ni las peticiones rechazadas tocan el SDK. Sin clave la llamada falla: generate da null (502),
// y si algo lanzara aquí, handleApi también lo trata como fallo de generación.
let claudeGenerate;
const generateWithClaude = (env, word) =>
  (claudeGenerate ??= createFigureGenerator({ client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) }))(word);

async function fetch(request, env) {
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return handleApi(request, env, { generate: env.MOCK_AI === '1' ? mockGenerateFigure : word => generateWithClaude(env, word) });
  }
  return env.ASSETS.fetch(request);
}

export default { fetch };
