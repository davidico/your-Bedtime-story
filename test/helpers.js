// Ayudantes de prueba: fetch falso, storage en memoria, IA falsa y una figura válida.

// fetch falso que siempre responde 200 con `body`; cuenta llamadas y guarda lo enviado.
export function fakeFetch(body, { status = 200, headers = {} } = {}) {
  const sent = [];
  const fetchImpl = async (url, init = {}) => {
    sent.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
  };
  return { fetchImpl, calls: () => sent.length, sent };
}

// fetch falso que responde solo un código de estado (401, 429, 500…), sin cuerpo útil.
export function fakeStatus(status, headers = {}) {
  const fetchImpl = async () => { fetchImpl.calls++; return new Response(null, { status, headers }); };
  fetchImpl.calls = 0;
  return fetchImpl;
}

// Storage con la interfaz de localStorage, en memoria.
export function memStorage(init = {}) {
  const data = { ...init };
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; },
  };
}

// IA falsa para el director: responde según `answers[concepto]` (o error) y cuenta llamadas.
// `cached[concepto]` simula lo que ya hay en L1 (respuesta síncrona).
export function fakeAI(answers, { enabled = true, cached = {} } = {}) {
  const asked = [];
  return {
    asked,
    enabled: () => enabled,
    cached: concept => cached[concept] || null,
    figure: async (concept, word) => { asked.push({ concept, word }); return answers[concept] || { status: 'error' }; },
  };
}

// Deja correr las promesas pendientes.
export const flush = () => new Promise(r => setTimeout(r, 0));

// Figura válida tal como la devuelve el Worker.
export const PANDA = {
  status: 'ok', canonical: 'panda', band: 'ground', size: 140, layer: 2, main: 'white',
  prims: [
    { t: 'circle', n: [50, 60, 30], color: 'white' },
    { t: 'circle', n: [50, 30, 15], color: 'white' },
    { t: 'dot', n: [45, 28, 2], color: 'ink' },
  ],
};
