// Worker: /api/* pasa por handleApi; todo lo demás son los assets estáticos del export de Next.
import { handleApi } from './api.js';
import { mockGenerateFigure } from './figure-ai.js';

// Hasta que llegue el generador de Claude (Tarea 8), sin MOCK_AI no hay figura: generate da null → 502.
const noGenerator = async () => null;

async function fetch(request, env) {
  if (new URL(request.url).pathname.startsWith('/api/')) {
    return handleApi(request, env, { generate: env.MOCK_AI === '1' ? mockGenerateFigure : noGenerator });
  }
  return env.ASSETS.fetch(request);
}

export default { fetch };
