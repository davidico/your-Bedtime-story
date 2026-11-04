// Vocabulario en español (sin tildes; normalizamos antes de buscar).
// Sustantivos → figura; '@' = acción de escena (noche, bosque…).
export const WORDS = {
  sol: 'sol', solecito: 'sol', luna: 'luna', estrella: 'estrella', lucero: 'estrella', nube: 'nube', nubecita: 'nube',
  lluvia: 'lluvia', llover: 'lluvia', llovia: 'lluvia', llueve: 'lluvia', tormenta: 'lluvia', arcoiris: 'arcoiris',
  arbol: 'arbol', arbolito: 'arbol', pino: 'arbol', casa: 'casa', casita: 'casa', hogar: 'casa', cabana: 'casa',
  flor: 'flor', florecita: 'flor', rosa: 'flor', margarita: 'flor',
  montana: 'montana', monte: 'montana', volcan: 'montana', colina: 'montana',
  mar: 'mar', agua: 'mar', rio: 'mar', lago: 'mar', oceano: 'mar', playa: 'mar', laguna: 'mar',
  barco: 'barco', barquito: 'barco', bote: 'barco', pez: 'pez', peces: 'pez', pescado: 'pez', pececito: 'pez',
  gato: 'gato', gatito: 'gato', gata: 'gato', gatita: 'gato', michi: 'gato',
  perro: 'perro', perrito: 'perro', perra: 'perro', perrita: 'perro', cachorro: 'perro',
  pajaro: 'pajaro', pajarito: 'pajaro', ave: 'pajaro', paloma: 'pajaro', pollito: 'pato',
  persona: 'persona', hombre: 'persona', senor: 'persona', amigo: 'nino', amiga: 'nina',
  nino: 'nino', nina: 'nina', chico: 'nino', chica: 'nina', bebe: 'nino', hijo: 'nino', hija: 'nina',
  mama: 'mama', mami: 'mama', madre: 'mama', mujer: 'mama', senora: 'mama', papa: 'papa', papi: 'papa', padre: 'papa',
  abuela: 'abuela', abuelita: 'abuela', abuelo: 'abuelo', abuelito: 'abuelo',
  rey: 'rey', reina: 'reina', princesa: 'princesa', principe: 'principe',
  castillo: 'castillo', palacio: 'castillo', coche: 'coche', carro: 'coche', auto: 'coche',
  corazon: 'corazon', amor: 'corazon', manzana: 'manzana', fruta: 'manzana',
  mariposa: 'mariposa', conejo: 'conejo', conejito: 'conejo', oso: 'oso', osito: 'oso',
  globo: 'globo', lobo: 'lobo', zorro: 'zorro', pato: 'pato', patito: 'pato', dragon: 'dragon', dragoncito: 'dragon',
  bosque: '@bosque', jardin: '@jardin', noche: '@noche', oscuro: '@noche', oscuridad: '@noche', dormir: '@noche',
  dormia: '@noche', durmio: '@noche', dia: '@dia', amanecer: '@dia', amanecio: '@dia', manana: '@dia', desperto: '@dia',
};

// Preposiciones y relaciones: "A sobre B", "A junto a B"…
export const PREPS = {
  sobre: 'sobre', encima: 'sobre', arriba: 'sobre',
  debajo: 'debajo', bajo: 'debajo', abajo: 'debajo',
  junto: 'junto', lado: 'junto', cerca: 'junto', con: 'junto', en: 'junto',
  dentro: 'dentro', adentro: 'dentro',
};

// Adjetivos de tamaño
export const ADJ = { grande: 1.5, enorme: 1.9, gigante: 2.1, grandote: 1.6, pequeno: 0.6, pequena: 0.6, pequenito: 0.5, chiquito: 0.5, chiquita: 0.5, chico: 0.6, diminuto: 0.45 };

// Órdenes de cámara ("miro a la izquierda", "camino hacia la casa")
export const CMDS = {
  izquierda: 'left', derecha: 'right',
  hacia: 'goto', camino: 'goto', camina: 'goto', caminamos: 'goto', caminaron: 'goto', voy: 'goto', vamos: 'goto', fue: 'goto', fueron: 'goto', llego: 'goto', llegaron: 'goto', corre: 'goto', corrio: 'goto', corrieron: 'goto',
  vuela: 'goto', volo: 'goto', volamos: 'goto', viaja: 'goto', viajo: 'goto', viajaron: 'goto',
  lejos: 'far', volver: 'back', volvemos: 'back', regresa: 'back', regresamos: 'back', regresaron: 'back',
};

// Artículos definidos: "el gato" se refiere al gato que ya está dibujado; "un gato" dibuja otro.
export const ARTS = new Set(['el', 'la', 'los', 'las', 'al', 'del']);

export const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function lookupNoun(w) {
  if (WORDS[w]) return { key: WORDS[w], plural: false };
  if (w.endsWith('es') && WORDS[w.slice(0, -2)]) return { key: WORDS[w.slice(0, -2)], plural: true };
  if (w.endsWith('s') && WORDS[w.slice(0, -1)]) return { key: WORDS[w.slice(0, -1)], plural: true };
  if (w.endsWith('ces') && WORDS[w.slice(0, -3) + 'z']) return { key: WORDS[w.slice(0, -3) + 'z'], plural: true };
  return null;
}

/** Convierte un texto en eventos: {raw, kind:'noun'|'prep'|'adj'|'cmd'|'none', key, plural, scale} */
export function tokens(text) {
  return text.split(/\s+/).filter(Boolean).map(raw => {
    const w = norm(raw).replace(/[^a-zñ]/g, '');
    if (!w) return { raw, kind: 'none' };
    const n = lookupNoun(w);
    if (n) return { raw, kind: 'noun', key: n.key, plural: n.plural };
    if (PREPS[w]) return { raw, kind: 'prep', key: PREPS[w] };
    if (ADJ[w]) return { raw, kind: 'adj', scale: ADJ[w] };
    if (CMDS[w]) return { raw, kind: 'cmd', key: CMDS[w] };
    if (ARTS.has(w)) return { raw, kind: 'art' };
    return { raw, kind: 'none' };
  });
}

export const VOCAB_LIST = [...new Set(Object.keys(WORDS).filter(k => !WORDS[k].startsWith('@')))];
