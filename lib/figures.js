// Figuras: cada una se define en una caja local de 100x100 con el suelo en y=100.
// S() = forma con relleno plano y contorno a lápiz; L() = sólo línea; dot() = punto relleno.

export const W = 1000, H = 700, GROUND = 600;

export const P = {
  ink: '#2b2a33', yellow: '#f6c445', orange: '#ef8a3c', red: '#e2533f', pink: '#f19bb0',
  green: '#6fae5b', dkgreen: '#3f7d4e', blue: '#4f8fd6', lblue: '#a9d4ef', brown: '#9a6a43',
  lbrown: '#c99a6b', grey: '#b9b4ad', white: '#fbfaf6', purple: '#8b6cc4', skin: '#f2c9a0',
  sand: '#efd3a0', stone: '#c9c2b6', slate: '#8fa3b8', hair: '#6b4a32', dark: '#3a3842',
};
export const PALETTE_KEYS = Object.keys(P);

export const circ = (cx, cy, r, n = 26) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
export const ell = (cx, cy, rx, ry, n = 26) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
export const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
export const S = (pts, fill) => ({ pts, fill, closed: true });
export const L = (pts, color) => ({ pts, closed: false, color });
export const dot = (x, y, r = 2) => ({ pts: circ(x, y, r, 8), fill: P.ink, closed: true, nostroke: true });

function person(o = {}) {
  const out = [];
  const top = o.dress ? 72 : 68;
  out.push(L([[45, top], [43, 98]]), L([[55, top], [57, 98]]));
  out.push(L([[40, 40], [28, 58]]), L([[60, 40], [72, 58]]));
  out.push(o.dress ? S([[50, 34], [33, 74], [67, 74]], o.color) : S(rect(40, 34, 60, 69), o.color));
  out.push(S(circ(50, 22, 11), P.skin));
  const cap = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + i / 12 * Math.PI; cap.push([50 + 12 * Math.cos(a), 21 + 12 * Math.sin(a)]); }
  out.push(S(cap, o.hair || P.hair));
  out.push(dot(46, 24, 1.4), dot(54, 24, 1.4));
  if (o.crown) out.push(S([[40, 11], [40, 2], [45, 7], [50, 0], [55, 7], [60, 2], [60, 11]], P.yellow));
  return out;
}
function bumpy(cx, cy, rx, ry, k, amp, flat) {
  return Array.from({ length: 44 }, (_, i) => {
    const a = i / 44 * Math.PI * 2, b = amp * Math.abs(Math.sin(k * a));
    let y = cy + (ry + b) * Math.sin(a); if (flat && Math.sin(a) > 0) y = cy + ry * 0.7 * Math.sin(a);
    return [cx + (rx + b) * Math.cos(a), y];
  });
}
function moon() {
  const o = []; for (let i = 0; i <= 18; i++) { const a = Math.PI * 0.3 + i / 18 * Math.PI * 1.4; o.push([50 + 24 * Math.cos(a), 50 + 24 * Math.sin(a)]); }
  const c = [62, 50], e1 = o[o.length - 1], e2 = o[0];
  const r = Math.hypot(e1[0] - c[0], e1[1] - c[1]);
  let a1 = Math.atan2(e1[1] - c[1], e1[0] - c[0]), a2 = Math.atan2(e2[1] - c[1], e2[0] - c[0]);
  if (a1 < 0) a1 += Math.PI * 2; if (a2 < 0) a2 += Math.PI * 2;
  for (let i = 1; i < 18; i++) { const a = a1 - (a1 - a2) * i / 18; o.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return o;
}
export const recolor = (prims, map) => prims.map(p => (p.fill && map[p.fill]) ? { ...p, fill: map[p.fill] } : p);

// band: 'sky' (cielo), 'ground' (suelo), 'water' (mar), 'fixed' (fondo de pantalla completa)
// size: alto aproximado en píxeles de la escena; layer: 0 fondo, 1 medio, 2 delante (sólo suelo)
// main: clave de P del color principal del cuerpo (la que se tiñe), o 'none' si no tiene uno claro
export const FIG = {
  sol: { band: 'sky', size: 150, main: 'yellow', draw: () => [...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2; return L([[50 + 28 * Math.cos(a), 50 + 28 * Math.sin(a)], [50 + 42 * Math.cos(a), 50 + 42 * Math.sin(a)]]); }), S(circ(50, 50, 21), P.yellow), dot(43, 47, 1.6), dot(57, 47, 1.6), L([[42, 56], [50, 61], [58, 56]])] },
  luna: { band: 'sky', size: 120, main: 'yellow', draw: () => [S(moon(), P.yellow)] },
  estrella: { band: 'sky', size: 50, main: 'yellow', draw: () => [S(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i / 10 * Math.PI * 2, r = i % 2 ? 12 : 28; return [50 + r * Math.cos(a), 52 + r * Math.sin(a)]; }), P.yellow)] },
  nube: { band: 'sky', size: 170, main: 'white', draw: () => [S(bumpy(50, 50, 36, 16, 4, 7, true), P.white)] },
  lluvia: { band: 'sky', size: 170, main: 'none', draw: () => [S(bumpy(50, 38, 36, 14, 4, 7, true), P.grey), ...[22, 36, 50, 64, 78].flatMap((x, i) => [L([[x, 58 + i % 2 * 6], [x - 3, 70 + i % 2 * 6]], P.blue), L([[x + 7, 78 - i % 2 * 6], [x + 4, 90 - i % 2 * 6]], P.blue)])] },
  arcoiris: { band: 'sky', size: 260, main: 'none', draw: () => [P.red, P.orange, P.yellow, P.green, P.blue, P.purple].map((c, i) => L(Array.from({ length: 20 }, (_, k) => { const a = Math.PI + k / 19 * Math.PI, r = 48 - i * 5; return [50 + r * Math.cos(a), 92 + r * Math.sin(a)]; }), c)) },
  arbol: { band: 'ground', size: 200, layer: 1, main: 'green', draw: () => [S(rect(44, 58, 56, 100), P.brown), S(bumpy(50, 38, 28, 26, 3, 5), P.green)] },
  casa: { band: 'ground', size: 210, layer: 1, main: 'sand', draw: () => [S(rect(18, 46, 82, 100), P.sand), S([[10, 48], [50, 12], [90, 48]], P.red), S(rect(44, 72, 58, 100), P.brown), S(rect(24, 58, 38, 72), P.lblue), L([[31, 58], [31, 72]]), L([[24, 65], [38, 65]])] },
  flor: { band: 'ground', size: 70, main: 'pink', draw: () => [L([[50, 100], [50, 52]], P.dkgreen), S(ell(58, 78, 8, 4), P.green), ...[0, 1, 2, 3, 4, 5].map(i => { const a = i / 6 * Math.PI * 2; return S(circ(50 + 10 * Math.cos(a), 42 + 10 * Math.sin(a), 7, 14), P.pink); }), S(circ(50, 42, 6, 14), P.yellow)] },
  montana: { band: 'ground', size: 380, layer: 0, main: 'none', draw: () => [S([[0, 100], [50, 12], [100, 100]], P.slate), S([[38, 34], [50, 12], [62, 34], [56, 30], [50, 37], [44, 30]], P.white)] },
  barco: { band: 'water', size: 180, main: 'brown', draw: () => [L([[50, 75], [50, 14]]), S([[53, 18], [53, 70], [86, 70]], P.white), S([[50, 14], [50, 6], [62, 10]], P.red), S([[12, 74], [88, 74], [76, 92], [24, 92]], P.brown)] },
  pez: { band: 'water', size: 80, main: 'orange', draw: () => [S([[68, 50], [92, 34], [90, 66]], P.orange), S(ell(45, 50, 27, 16), P.orange), dot(32, 46, 2.2), L([[52, 38], [56, 50], [52, 62]])] },
  gato: { band: 'ground', size: 100, main: 'grey', draw: () => [L([[70, 78], [86, 64], [84, 48]]), L([[38, 90], [38, 100]]), L([[60, 90], [60, 100]]), S(ell(50, 80, 22, 14), P.grey), S([[19, 46], [21, 30], [31, 40]], P.grey), S([[30, 40], [39, 30], [41, 46]], P.grey), S(circ(30, 54, 14), P.grey), dot(25, 52), dot(35, 52), L([[28, 59], [30, 61], [32, 59]])] },
  perro: { band: 'ground', size: 110, main: 'lbrown', draw: () => [L([[36, 82], [34, 100]]), L([[46, 84], [46, 100]]), L([[62, 84], [62, 100]]), L([[72, 82], [74, 100]]), L([[76, 68], [90, 56]]), S(ell(54, 74, 25, 13), P.lbrown), S(circ(28, 56, 14), P.lbrown), S(ell(22, 58, 5, 10), P.brown), dot(30, 52), dot(16, 58, 2.6)] },
  pajaro: { band: 'sky', size: 70, main: 'blue', draw: () => [S([[34, 46], [22, 50], [34, 54]], P.orange), S(circ(50, 50, 16), P.blue), S(ell(54, 53, 10, 6), P.lblue), dot(42, 45)] },
  persona: { band: 'ground', size: 170, main: 'blue', draw: () => person({ color: P.blue }) },
  nina: { band: 'ground', size: 160, main: 'pink', draw: () => person({ color: P.pink, dress: true }) },
  nino: { band: 'ground', size: 160, main: 'green', draw: () => person({ color: P.green }) },
  mama: { band: 'ground', size: 180, main: 'purple', draw: () => person({ color: P.purple, dress: true }) },
  papa: { band: 'ground', size: 185, main: 'blue', draw: () => person({ color: P.blue }) },
  abuela: { band: 'ground', size: 170, main: 'lblue', draw: () => person({ color: P.lblue, dress: true, hair: P.grey }) },
  abuelo: { band: 'ground', size: 175, main: 'lbrown', draw: () => person({ color: P.lbrown, hair: P.grey }) },
  rey: { band: 'ground', size: 185, main: 'red', draw: () => person({ color: P.red, crown: true }) },
  reina: { band: 'ground', size: 180, main: 'purple', draw: () => person({ color: P.purple, dress: true, crown: true }) },
  princesa: { band: 'ground', size: 165, main: 'pink', draw: () => person({ color: P.pink, dress: true, crown: true, hair: P.yellow }) },
  principe: { band: 'ground', size: 170, main: 'blue', draw: () => person({ color: P.blue, crown: true }) },
  castillo: { band: 'ground', size: 300, layer: 1, main: 'stone', draw: () => {
    const o = [S(rect(15, 40, 85, 100), P.stone)];
    for (let x = 15; x < 85; x += 10) o.push(S(rect(x, 34, x + 5, 40), P.stone));
    o.push(S(rect(4, 26, 28, 100), P.stone), S(rect(72, 26, 96, 100), P.stone), S([[1, 27], [16, 2], [31, 27]], P.red), S([[69, 27], [84, 2], [99, 27]], P.red),
      S([[42, 100], [42, 76], [50, 68], [58, 76], [58, 100]], P.brown), S(rect(12, 44, 20, 54), P.dark), S(rect(80, 44, 88, 54), P.dark));
    return o;
  } },
  coche: { band: 'ground', size: 170, main: 'red', draw: () => [S([[8, 84], [8, 66], [28, 63], [36, 48], [66, 48], [76, 63], [92, 66], [92, 84]], P.red), S([[40, 53], [62, 53], [70, 63], [34, 63]], P.lblue), L([[51, 53], [51, 63]]), S(circ(28, 86, 9), P.dark), S(circ(72, 86, 9), P.dark)] },
  corazon: { band: 'sky', size: 70, main: 'red', draw: () => [S(Array.from({ length: 32 }, (_, i) => { const t = i / 32 * Math.PI * 2; return [50 + 2.4 * 16 * Math.sin(t) ** 3, 46 - 2.4 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; }), P.red)] },
  manzana: { band: 'ground', size: 50, main: 'red', draw: () => [L([[50, 44], [53, 30]], P.brown), S(ell(60, 34, 8, 4), P.green), S(circ(50, 64, 20), P.red)] },
  mariposa: { band: 'sky', size: 75, main: 'purple', draw: () => [L([[49, 36], [42, 20]]), L([[51, 36], [58, 20]]), S(ell(37, 42, 13, 14), P.purple), S(ell(63, 42, 13, 14), P.purple), S(circ(40, 62, 9), P.pink), S(circ(60, 62, 9), P.pink), S(ell(50, 52, 3, 17, 12), P.ink)] },
  conejo: { band: 'ground', size: 85, main: 'white', draw: () => [S(ell(43, 34, 4.5, 14), P.white), S(ell(57, 34, 4.5, 14), P.white), S(ell(50, 82, 18, 15), P.white), S(circ(50, 56, 11), P.white), dot(46, 55), dot(54, 55), dot(50, 60, 1.6)] },
  oso: { band: 'ground', size: 140, main: 'brown', draw: () => [S(circ(38, 30, 6), P.brown), S(circ(62, 30, 6), P.brown), S(circ(50, 74, 24), P.brown), S(circ(50, 42, 15), P.brown), S(circ(50, 47, 5.5), P.sand), dot(44, 39), dot(56, 39), dot(50, 45, 1.8)] },
  globo: { band: 'sky', size: 90, main: 'red', draw: () => [L([[50, 56], [46, 98]]), S(ell(50, 34, 17, 21), P.red), S([[47, 55], [53, 55], [50, 59]], P.red)] },
  lobo: { band: 'ground', size: 110, main: 'grey', draw: () => recolor(FIG.perro.draw(), { [P.lbrown]: P.grey, [P.brown]: P.slate }) },
  zorro: { band: 'ground', size: 100, main: 'orange', draw: () => recolor(FIG.perro.draw(), { [P.lbrown]: P.orange, [P.brown]: P.orange }) },
  pato: { band: 'ground', size: 70, main: 'yellow', draw: () => [L([[46, 66], [46, 100]], P.orange), L([[56, 66], [56, 100]], P.orange), ...recolor(FIG.pajaro.draw(), { [P.blue]: P.yellow, [P.lblue]: '#f9dc85' })] },
  dragon: { band: 'ground', size: 160, main: 'green', draw: () => [S([[30, 60], [10, 30], [40, 48]], P.green), S([[70, 60], [90, 30], [60, 48]], P.green), L([[78, 76], [96, 64], [98, 52]]), ...recolor(FIG.perro.draw(), { [P.lbrown]: P.green, [P.brown]: P.dkgreen }), L([[8, 62], [2, 58]], P.orange), L([[8, 62], [2, 66]], P.orange)] },
  mar: { band: 'fixed', main: 'none', draw: () => {
    const top = []; for (let x = 0; x <= W; x += 25) top.push([x, 612 + 7 * Math.sin(x / 40)]);
    const o = [S([...top, [W, H], [0, H]], P.lblue)];
    for (let r = 0; r < 2; r++) for (let x = 60 + r * 90; x < W; x += 180) o.push(L([[x, 645 + r * 28], [x + 14, 639 + r * 28], [x + 28, 645 + r * 28]], P.blue));
    return o;
  } },
  // interna: marcador de espera mientras llega una figura generada (garabato tenue a lápiz)
  __pending: { band: 'ground', size: 110, main: 'none', draw: () => [62, 74, 86].map((y, k) => L(Array.from({ length: 14 }, (_, i) => [22 + i * 4.3 + k * 2, y + 5 * Math.sin(i * 1.3 + k * 2)]), P.grey)) },
};

// Registro en tiempo de ejecución de figuras generadas; sus claves llevan prefijo 'g:' para no pisar las locales.
export function registerFigure(key, def) {
  if (typeof key !== 'string' || !key.startsWith('g:')) throw new Error(`clave de figura sin prefijo g: ${key}`);
  FIG[key] = def;
}

// Tinte: cambia el relleno del color main por el de tintKey; el resto (ojos, contornos, detalles) queda igual.
export function tintPrims(prims, mainKey, tintKey) {
  if (!tintKey || mainKey === 'none' || !P[mainKey] || !P[tintKey]) return prims;
  return recolor(prims, { [P[mainKey]]: P[tintKey] });
}
