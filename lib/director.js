// Director: reparte los tokens de voz. Los conocidos van a la escena; un desconocido (unk) deja un
// pendiente en su sitio y la IA lo resuelve o lo hace desaparecer en silencio. Sin IA ni caché, como hoy.
import { normalizeConcept } from './figure-format.js';

export function createDirector({ scene, ai }) {
  const drawable = r => r && (r.status === 'ok' || r.status === 'builtin') && r.key;
  function unknown(ev) {
    const concept = normalizeConcept(ev.word);
    // Sin código ni caché (modo local, pausa, código rechazado) o negativo ya conocido: ni pendiente ni red.
    // touch(): el color que venga detrás es de esta palabra, no del dibujo anterior.
    const hit = concept ? ai.cached?.(concept) : null;
    if (!concept || (hit ? !drawable(hit) : !ai.enabled())) return scene.touch();
    const ids = scene.addPending(concept, { plural: ev.plural });
    if (!ids.length) return; // "el panda": referencia a uno que ya está
    ai.figure(concept, ev.word).then(
      r => (drawable(r) ? scene.resolvePending(ids, r.key) : scene.dropPending(ids)),
      () => scene.dropPending(ids));
  }
  return {
    onEvents(events) {
      for (const ev of events) {
        if (ev.kind === 'none') { if (ev.gap) scene.touch(); continue; } // "el cielo": el color siguiente es suyo
        if (ev.kind === 'unk') unknown(ev); else scene.handle(ev);
      }
    },
  };
}
