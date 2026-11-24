// Lista negra local (spec §5.9 y respuesta 2 de la dueña): se mira antes de llamar al modelo.
// Corta y mantenible, no exhaustiva: el modelo también clasifica. Se compara por palabra completa,
// con los términos normalizados igual que los conceptos (sin tildes, singular ingenuo).
import { normalizeConcept } from '../lib/figure-format.js';

const TERMS = [
  // sexual y desnudez
  'sexo', 'sexual', 'desnudo', 'desnuda', 'porno', 'pene', 'vagina', 'teta', 'condon', 'prostituta',
  // drogas, alcohol y tabaco
  'droga', 'cocaina', 'marihuana', 'heroina', 'porro', 'jeringuilla', 'alcohol', 'cerveza', 'vino', 'whisky',
  'vodka', 'tequila', 'borracho', 'tabaco', 'cigarro', 'cigarrillo', 'vaper',
  // armas de fuego y sangre
  'pistola', 'revolver', 'rifle', 'escopeta', 'metralleta', 'ametralladora', 'fusil', 'bala', 'sangre', 'herida', 'cadaver', 'suicidio',
  // odio e insultos
  'nazi', 'esvastica', 'racista', 'puta', 'mierda', 'gilipollas', 'cabron', 'maricon', 'imbecil', 'idiota', 'estupido',
];
const SET = new Set(TERMS.map(normalizeConcept));

/** true si alguna palabra del texto (ya normalizado o no) está en la lista negra. */
export const isBlocked = text => normalizeConcept(text).split(' ').some(w => SET.has(w));
