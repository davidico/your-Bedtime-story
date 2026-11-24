// Director: reparte los tokens de voz. Los conocidos van a la escena; un desconocido (unk) deja un
// pendiente en su sitio y la IA lo resuelve o lo hace desaparecer en silencio. Sin IA, como hoy.
import { normalizeConcept } from './figure-format.js';

export function createDirector({ scene, ai }) {
  function unknown(ev) {
    if (!ai.enabled()) return;
    const concept = normalizeConcept(ev.word);
    if (!concept) return;
    const ids = scene.addPending(concept, { plural: ev.plural });
    if (!ids.length) return; // "el panda": referencia a uno que ya está
    ai.figure(concept, ev.word).then(
      r => (r && (r.status === 'ok' || r.status === 'builtin') && r.key ? scene.resolvePending(ids, r.key) : scene.dropPending(ids)),
      () => scene.dropPending(ids));
  }
  return {
    onEvents(events) {
      for (const ev of events) {
        if (ev.kind === 'none') continue;
        if (ev.kind === 'unk') unknown(ev); else scene.handle(ev);
      }
    },
  };
}
