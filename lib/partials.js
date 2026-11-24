/** Estabilidad de los parciales de voz: la Web Speech API reescribe los resultados
 *  no finales ("un pan" → "un panda"). Un `unk` que sea el último token de un parcial
 *  se retiene (`held`) hasta que se estabilice; el resto (sin los `none`) está listo. */
export function splitHeld(toks, isFinal) {
  const last = toks[toks.length - 1];
  const held = !isFinal && last?.kind === 'unk' ? last : null;
  const ready = toks.filter(t => t.kind !== 'none' && t !== held);
  return { ready, held };
}

export const HOLD_MS = 600; // espera de un desconocido final antes de darlo por estable

/** De-dup por índice de resultado + temporizador del retenido. emit(events) recibe solo lo nuevo.
 *  feed(i, toks, isFinal): emite los `ready` nuevos; si hay `held`, lo emite tras `ms` sin otro feed de ese índice.
 *  clear(): descarta los retenidos pendientes (pausa); reset(): además olvida lo visto (nueva sesión). */
export function createHolds(emit, ms = HOLD_MS) {
  let done = new Map(), timers = new Map();
  const clear = () => { timers.forEach(t => clearTimeout(t)); timers = new Map(); };
  return {
    feed(i, toks, isFinal) {
      const { ready, held } = splitHeld(toks, isFinal);
      const seen = done.get(i) || 0;
      if (ready.length > seen) emit(ready.slice(seen));
      done.set(i, Math.max(seen, ready.length));
      clearTimeout(timers.get(i)); timers.delete(i);
      // `held` sale de este mismo texto: si se reescribe ("pan" → "panda") el feed siguiente rehace el temporizador
      if (held) timers.set(i, setTimeout(() => {
        timers.delete(i);
        if ((done.get(i) || 0) > ready.length) return; // ya contado
        emit([held]); done.set(i, ready.length + 1);
        // aceptado por la spec: una reescritura posterior en esta posición ya cuenta como vista y no se re-emite
      }, ms));
    },
    clear,
    reset() { clear(); done = new Map(); },
  };
}
