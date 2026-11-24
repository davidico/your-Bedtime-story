// Vocabulario en español (sin tildes; normalizamos antes de buscar).
// Sustantivos → figura; '@' = acción de escena (noche, bosque…).
import { normalizeConcept } from './figure-format.js';

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
export const ADJ = { grande: 1.5, gran: 1.5, enorme: 1.9, gigante: 2.1, grandote: 1.6, pequeno: 0.6, pequena: 0.6, pequenito: 0.5, chiquito: 0.5, chiquita: 0.5, chico: 0.6, diminuto: 0.45 };

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

export function lookupNoun(w) {
  if (WORDS[w]) return { key: WORDS[w], plural: false };
  if (w.endsWith('es') && WORDS[w.slice(0, -2)]) return { key: WORDS[w.slice(0, -2)], plural: true };
  if (w.endsWith('s') && WORDS[w.slice(0, -1)]) return { key: WORDS[w.slice(0, -1)], plural: true };
  if (w.endsWith('ces') && WORDS[w.slice(0, -3) + 'z']) return { key: WORDS[w.slice(0, -3) + 'z'], plural: true };
  return null;
}

// Colores → clave de paleta (con género y número).
export const COLORS = {
  rojo: 'red', roja: 'red', rojos: 'red', rojas: 'red', azul: 'blue', azules: 'blue', celeste: 'lblue', celestes: 'lblue',
  verde: 'green', verdes: 'green', amarillo: 'yellow', amarilla: 'yellow', amarillos: 'yellow', amarillas: 'yellow',
  naranja: 'orange', naranjas: 'orange', anaranjado: 'orange', anaranjada: 'orange', rosa: 'pink', rosas: 'pink', rosado: 'pink', rosada: 'pink',
  morado: 'purple', morada: 'purple', morados: 'purple', moradas: 'purple', violeta: 'purple', violetas: 'purple', lila: 'purple',
  marron: 'brown', marrones: 'brown', gris: 'grey', grises: 'grey', blanco: 'white', blanca: 'white', blancos: 'white', blancas: 'white',
  negro: 'dark', negra: 'dark', negros: 'dark', negras: 'dark', dorado: 'yellow', dorada: 'yellow', plateado: 'grey', plateada: 'grey',
  // comparaciones tras "color": "de color tomate"
  tomate: 'red', cielo: 'lblue', chocolate: 'brown', limon: 'yellow', hierba: 'green', fresa: 'red', zanahoria: 'orange',
};
// Color solo tras "color" o justo tras un sustantivo; si no, sustantivo ("una rosa").
const AMBIGUOUS_COLORS = new Set(['rosa', 'rosas', 'naranja', 'naranjas', 'violeta', 'violetas', 'cielo', 'chocolate', 'limon', 'fresa']);
// Comparaciones: color solo tras la palabra "color".
const COMPARE = new Set(['tomate', 'cielo', 'chocolate', 'limon', 'hierba', 'fresa', 'zanahoria']);

// Determinantes que anuncian un sustantivo: tras ellos una palabra desconocida es candidata a figura.
export const DETS = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'al', 'del',
  'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'muchos', 'muchas', 'varios', 'varias', 'otro', 'otra', 'otros', 'otras', 'su', 'sus', 'mi', 'mis', 'tu', 'tus']);

// Palabras funcionales y sustantivos no dibujables frecuentes en cuentos (nunca son `unk`).
export const STOP = new Set(['vez', 'rato', 'ratito', 'poco', 'poquito', 'momento', 'momentito', 'tiempo', 'cosa', 'lugar', 'sitio', 'ano',
  'tarde', 'final', 'fin', 'principio', 'susto', 'idea', 'cuento', 'historia', 'verdad', 'lado', 'manera', 'forma', 'parte', 'resto',
  'mitad', 'medio', 'vida', 'nombre', 'sueno', 'miedo', 'alegria', 'ruido', 'grito', 'viaje', 'aventura', 'problema', 'pregunta',
  'respuesta', 'hora', 'minuto', 'segundo', 'semana', 'mes', 'abrazo', 'beso', 'juego', 'favor', 'mundo', 'que', 'cual', 'mismo', 'misma',
  'mucho', 'mucha', 'primer', 'primero', 'primera', 'ultimo', 'ultima', 'buen', 'bueno', 'buena', 'mal', 'malo', 'mala', 'solo', 'sola',
  'todo', 'toda', 'todos', 'todas', 'nada', 'algo', 'cada', 'este', 'esta', 'ese', 'esa', 'aquel', 'aquella', 'nuevo', 'nueva', 'viejo', 'vieja',
  'cielo']);
// Adjetivos que en los cuentos van delante del sustantivo ("el feroz lobo", "la hermosa casa"): no son figura y
// no rompen el determinante.
const PRE_ADJ = ['hermoso', 'hermosa', 'bonito', 'bonita', 'lindo', 'linda', 'bello', 'bella', 'malvado', 'malvada', 'feroz', 'feroces',
  'dulce', 'pobre', 'querido', 'querida', 'valiente', 'travieso', 'traviesa', 'joven', 'precioso', 'preciosa', 'simpatico',
  'simpatica', 'alegre', 'triste', 'feliz', 'felices', 'curioso', 'curiosa', 'misterioso', 'misteriosa', 'extrano', 'extrana', 'sabio',
  'sabia', 'astuto', 'astuta', 'amable', 'terrible', 'temible', 'famoso', 'famosa', 'maravilloso', 'maravillosa', 'magico', 'magica',
  'dormilon', 'dormilona', 'gloton', 'glotona', 'peludo', 'peluda', 'hambriento', 'hambrienta', 'perezoso', 'perezosa'];
for (const w of PRE_ADJ) STOP.add(w);
const stopped = w => STOP.has(w) || (w.endsWith('s') && STOP.has(w.slice(0, -1))) || (w.endsWith('es') && STOP.has(w.slice(0, -2)));
// Palabras de STOP que funcionan como adjetivo delante del sustantivo ("una nueva amiga").
const STOP_ADJ = new Set(['buen', 'bueno', 'buena', 'mal', 'malo', 'mala', 'nuevo', 'nueva', 'viejo', 'vieja', 'primer', 'primero', 'primera',
  'ultimo', 'ultima', 'mismo', 'misma', 'solo', 'sola', 'mucho', 'mucha', ...PRE_ADJ]);
const isAdj = w => ADJ[w] || (w.endsWith('s') && ADJ[w.slice(0, -1)]) || (w.endsWith('es') && ADJ[w.slice(0, -2)]);
const isStopAdj = w => STOP_ADJ.has(w) || (w.endsWith('s') && STOP_ADJ.has(w.slice(0, -1))) || (w.endsWith('es') && STOP_ADJ.has(w.slice(0, -2)));
// Plural de verdad: acaba en -s y no es un singular en -s ("un autobús" es uno).
const isPlural = w => w.endsWith('s') && normalizeConcept(w) !== w;

function classify(raw, w, st) {
  if (COLORS[w] && (st.afterColorWord || (!COMPARE.has(w) && (!AMBIGUOUS_COLORS.has(w) || st.prevWasNoun)))) return { raw, kind: 'color', key: COLORS[w] };
  const n = lookupNoun(w);
  if (n) return { raw, kind: 'noun', key: n.key, plural: n.plural };
  // sustantivo no dibujable tras determinante ("el cielo", "una vez"): sigue siendo 'none' (los parciales no lo cuentan),
  // con `gap` para que el director cierre la ventana de color del dibujo anterior
  if (st.afterDet && stopped(w) && !isStopAdj(w)) return { raw, kind: 'none', gap: true };
  // ambiguo y no está en WORDS: tras determinante es sustantivo candidato ("una naranja")
  if (AMBIGUOUS_COLORS.has(w)) return st.afterDet ? { raw, kind: 'unk', word: w, plural: isPlural(w) } : { raw, kind: 'none' };
  if (PREPS[w]) return { raw, kind: 'prep', key: PREPS[w] };
  if (ADJ[w]) return { raw, kind: 'adj', scale: ADJ[w] };
  if (CMDS[w]) return { raw, kind: 'cmd', key: CMDS[w] };
  if (ARTS.has(w)) return { raw, kind: 'art' };
  if (st.afterDet && w.length >= 3 && !DETS.has(w) && !isAdj(w) && !stopped(w) && w !== 'color' && w !== 'colores')
    return { raw, kind: 'unk', word: w, plural: isPlural(w) };
  return { raw, kind: 'none' };
}

/** Convierte un texto en eventos con `pos` (índice de palabra):
 *  {raw, kind:'noun'|'prep'|'adj'|'cmd'|'art'|'unk'|'color'|'none', key, plural, scale, word, gap, pos} */
export function tokens(text) {
  const st = { afterDet: false, afterColorWord: false, prevWasNoun: false };
  return text.split(/\s+/).filter(Boolean).map((raw, pos) => {
    const w = norm(raw).replace(/[^a-zñ]/g, '');
    if (!w) return { raw, kind: 'none', pos };
    const t = classify(raw, w, st);
    // estado: el determinante se mantiene saltando adjetivos y colores ("un gran dinosaurio", "un rojo dinosaurio")
    st.afterDet = DETS.has(w) || (st.afterDet && (t.kind === 'adj' || t.kind === 'color' || (t.kind === 'none' && (isAdj(w) || isStopAdj(w)))));
    st.afterColorWord = w === 'color' || w === 'colores';
    st.prevWasNoun = t.kind === 'noun' || t.kind === 'unk';
    t.pos = pos;
    return t;
  });
}

export const VOCAB_LIST = [...new Set(Object.keys(WORDS).filter(k => !WORDS[k].startsWith('@')))];
