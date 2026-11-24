// Generadores de figura para el Worker. En esta tarea solo el simulado (MOCK_AI=1); el de Claude llega después.
import { normalizeConcept } from '../lib/figure-format.js';

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
