// Generadores de figura para el Worker: Claude (Haiku con salida estructurada), Workers AI (gratis) y el simulado (MOCK_AI=1).
// Todos devuelven la salida cruda del modelo (o null); el Worker la sanea con sanitizeFigure.
import { normalizeConcept, FIGURE_SCHEMA } from '../lib/figure-format.js';
import { FIGURE_SYSTEM_PROMPT } from './prompts/figure.js';

/**
 * Generador con Claude. `client` es un cliente de @anthropic-ai/sdk (o uno falso en pruebas).
 * Devuelve (word) => Promise<raw|null>: rechazo → blocked; max_tokens, JSON roto o error del SDK → null.
 * `onUsage(usage)` recibe response.usage para medir coste y aciertos de caché.
 */
export function createFigureGenerator({ client, model = 'claude-haiku-5-5', onUsage } = {}) {
  return async function generate(word) {
    let res;
    try {
      res = await client.messages.create({
        model, max_tokens: 4000,
        system: [{ type: 'text', text: FIGURE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'low', format: { type: 'json_schema', schema: FIGURE_SCHEMA } },
        messages: [{ role: 'user', content: `<concepto>${word}</concepto>` }],
      });
    } catch { return null; }
    if (res?.usage && onUsage) { try { onUsage(res.usage); } catch { /* la medición nunca tumba la figura */ } }
    // Primero stop_reason: un rechazo es un bloqueo (sin reintento); truncado no se cachea.
    if (res?.stop_reason === 'refusal') return { status: 'blocked', canonical: word, band: 'ground', size: 100, layer: 2, main: 'none', prims: [] };
    if (!res || res.stop_reason === 'max_tokens') return null;
    // Puede haber bloques de pensamiento delante: vale el primer bloque de texto.
    const text = (res.content || []).find(b => b.type === 'text')?.text;
    try { return text ? JSON.parse(text) : null; } catch { return null; }
  };
}

/**
 * Generador con Workers AI (binding `AI`, sin secretos). Mismo prompt, mismo turno `<concepto>` y mismo contrato:
 * (word) => Promise<raw|null>; respuesta ilegible, truncada o error → null. El modelo marca él mismo los bloqueos.
 */
export function createWorkersAIGenerator({ ai, model = '@cf/openai/gpt-oss-120b' } = {}) {
  return async function generate(word) {
    try {
      const res = await ai.run(model, {
        messages: [{ role: 'system', content: FIGURE_SYSTEM_PROMPT }, { role: 'user', content: `<concepto>${word}</concepto>` }],
        response_format: { type: 'json_schema', json_schema: FIGURE_SCHEMA },
        max_tokens: 3000,
      });
      return parseAIResult(res);
    } catch { return null; }
  };
}

// Formas vistas: la figura ya como objeto, una cadena JSON, { response } (cadena u objeto),
// estilo OpenAI { choices: [{ message: { content } }] } o estilo Responses { output: [{ content: [{ text }] }] }.
export function parseAIResult(res, depth = 0) {
  if (res == null || depth > 3) return null;
  if (typeof res === 'string') { try { return parseAIResult(JSON.parse(res), depth + 1); } catch { return null; } }
  if (typeof res !== 'object' || Array.isArray(res)) return null;
  if (typeof res.status === 'string') return res;
  if (res.response != null) return parseAIResult(res.response, depth + 1);
  const choice = res.choices?.[0];
  if (choice) return choice.finish_reason === 'length' ? null : parseAIResult(choice.message?.content, depth + 1);
  if (Array.isArray(res.output)) {
    const text = res.output.flatMap(o => o?.content || []).find(c => typeof c?.text === 'string')?.text;
    return parseAIResult(text, depth + 1);
  }
  return null;
}

/** Simulado: cuerpo elipse + cabeza círculo con dos ojos; 'nada' no se dibuja y 'perrito' es el perro de FIG. */
export async function mockGenerateFigure(word) {
  const canonical = normalizeConcept(word);
  const base = { canonical, band: 'ground', size: 110, layer: 1, main: 'grey', prims: [] };
  if (canonical === 'nada') return { ...base, status: 'not_drawable', main: 'none' };
  if (canonical === 'perrito') return { ...base, status: 'builtin', canonical: 'perro', main: 'none' };
  return { ...base, status: 'ok', prims: [
    { t: 'ellipse', n: [55, 72, 26, 16], color: 'grey' },
    { t: 'circle', n: [28, 52, 14], color: 'grey' },
    { t: 'dot', n: [23, 50, 2], color: 'ink' },
    { t: 'dot', n: [33, 50, 2], color: 'ink' },
  ] };
}
