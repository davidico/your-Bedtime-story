// Generadores de figura para el Worker: el de Claude (Haiku con salida estructurada) y el simulado (MOCK_AI=1).
// Ambos devuelven la salida cruda del modelo (o null); el Worker la sanea con sanitizeFigure.
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
