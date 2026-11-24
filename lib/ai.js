// Cliente IA del navegador (spec §5.3, §5.8–§5.10): pide figuras al Worker con el código de familia,
// guarda una caché L1 (memoria + storage) y pasa a modo local ante 401 (código malo) o 429 (pausa).
import { sanitizeFigure, expandFigure, FORMAT_VERSION } from './figure-format.js';
import { FIG, registerFigure } from './figures.js';

const CODE_KEY = 'ys:code', L1_KEY = `ys:fig:${FORMAT_VERSION}`, L1_MAX = 300, TIMEOUT_MS = 8000;
const ERROR = Object.freeze({ status: 'error' });

export function createAI({ fetchImpl = (...a) => fetch(...a), storage = null, apiBase = '', now = Date.now } = {}) {
  // storage opcional: nulo o que lanza (modo privado) → solo memoria
  const get = k => { try { return storage ? storage.getItem(k) : null; } catch { return null; } };
  const set = (k, v) => { try { storage && storage.setItem(k, v); } catch { /* solo memoria */ } };
  const del = k => { try { storage && storage.removeItem(k); } catch { /* solo memoria */ } };

  let code = (get(CODE_KEY) || '').trim(), pausedUntil = 0;
  // L1: concepto → { status, key?, figure? }, en orden de inserción (los conceptos son letras: nunca claves numéricas)
  const l1 = new Map();
  try { for (const [c, e] of Object.entries(JSON.parse(get(L1_KEY) || '{}'))) if (e && e.status) l1.set(c, e); } catch { /* L1 corrupta: vacía */ }
  const inflight = new Map();

  const remember = (concept, entry) => {
    l1.delete(concept); l1.set(concept, entry);
    while (l1.size > L1_MAX) l1.delete(l1.keys().next().value); // sale lo más antiguo
    set(L1_KEY, JSON.stringify(Object.fromEntries(l1)));
  };
  const forget = concept => { l1.delete(concept); set(L1_KEY, JSON.stringify(Object.fromEntries(l1))); };

  // Convierte una entrada (de red o de L1) en el resultado; registra la figura generada si hace falta.
  function settle(entry) {
    if (entry.status === 'ok') {
      const fig = sanitizeFigure(entry.figure), key = 'g:' + entry.key;
      if (!fig || fig.status !== 'ok') return null;
      if (!FIG[key]) registerFigure(key, expandFigure(fig));
      return { status: 'ok', key };
    }
    if (entry.status === 'builtin') return FIG[entry.key] ? { status: 'builtin', key: entry.key } : null;
    if (entry.status === 'not_drawable' || entry.status === 'blocked') return { status: entry.status };
    return null;
  }

  async function request(concept, word) {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetchImpl(`${apiBase}/api/figure`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-Family-Code': code },
        body: JSON.stringify({ concept, word: word ?? concept }),
      });
      if (res.status === 401) { ai.setCode(''); return ERROR; }
      if (res.status === 429) {
        const s = Number(res.headers.get('Retry-After'));
        pausedUntil = now() + (Number.isFinite(s) && s > 0 ? s : 60) * 1000;
        return ERROR;
      }
      if (!res.ok) return ERROR;
      const data = await res.json();
      if (!data || typeof data.key !== 'string' || !data.key) return ERROR;
      const entry = data.status === 'ok' ? { status: 'ok', key: data.key, figure: sanitizeFigure(data.figure) }
        : { status: data.status, key: data.key };
      const out = settle(entry);
      if (!out) return ERROR; // figura inválida o builtin desconocido: no se cachea
      remember(concept, entry);
      return out;
    } catch { return ERROR; } finally { clearTimeout(timer); }
  }

  const ai = {
    enabled: () => !!code && now() >= pausedUntil,
    getCode: () => code,
    setCode(c) {
      code = String(c ?? '').trim(); pausedUntil = 0;
      code ? set(CODE_KEY, code) : del(CODE_KEY);
    },
    // concept: clave de caché (ya normalizada); word: palabra original, viaja para que el Worker la vea tal cual
    figure(concept, word) {
      const hit = l1.get(concept);
      if (hit) { const out = settle(hit); if (out) return Promise.resolve(out); forget(concept); }
      if (!ai.enabled()) return Promise.resolve(ERROR);
      if (!inflight.has(concept)) inflight.set(concept, request(concept, word).finally(() => inflight.delete(concept)));
      return inflight.get(concept);
    },
  };
  return ai;
}
