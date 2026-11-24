/** Estabilidad de los parciales de voz: la Web Speech API reescribe los resultados
 *  no finales ("un pan" → "un panda"). Un `unk` que sea el último token de un parcial
 *  se retiene (`held`) hasta que se estabilice; el resto (sin los `none`) está listo. */
export function splitHeld(toks, isFinal) {
  const last = toks[toks.length - 1];
  const held = !isFinal && last?.kind === 'unk' ? last : null;
  const ready = toks.filter(t => t.kind !== 'none' && t !== held);
  return { ready, held };
}
