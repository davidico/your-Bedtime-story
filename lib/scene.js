// Motor de escena: coloca figuras en bandas (cielo / suelo / mar), las dibuja con trazo
// de lápiz animado y relleno plano, y entiende relaciones ("sobre", "junto a"),
// tamaños ("grande"), colores ("rojo") y cámara por voz ("miro a la izquierda", "camino hacia la casa").
// Cada elemento lleva id estable ('e1', 'e2'…), noun (concepto), tint y pending: un sustantivo desconocido
// se coloca ya como marcador '__pending' y luego se sustituye en su sitio por la figura real o se desvanece.
import { FIG, P, W, H, GROUND, tintPrims } from './figures';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

function wobble(pts, closed, r, amt) {
  const out = []; const n = pts.length; const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n]; const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const k = Math.max(1, Math.round(len / 12));
    for (let j = 0; j < k; j++) { const t = j / k; out.push([a[0] + (b[0] - a[0]) * t + (r() - .5) * amt, a[1] + (b[1] - a[1]) * t + (r() - .5) * amt]); }
  }
  if (closed) out.push(out[0]); else { const z = pts[n - 1]; out.push([z[0] + (r() - .5) * amt, z[1] + (r() - .5) * amt]); }
  return out;
}

const mixHex = (a, b, t) => {
  const pa = [1, 3, 5].map(i => parseInt(a.substr(i, 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.substr(i, 2), 16));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')';
};

const DRAW_MS = 1100;   // duración de la animación de trazo
const GAP_MS = 380;     // separación entre figuras encoladas
const SCRIBBLE_MS = 250; // el garabato de espera sólo aparece si la figura tarda más que esto
const FADE_MS = 400;    // desvanecido de un pendiente descartado
const WINDOW_MS = 3000; // ventana para que tamaño/color se apliquen al último elemento

export class Scene {
  constructor() {
    this.items = []; this.night = false; this.nightMix = 0;
    this.camX = 0; this.camTarget = 0; this.queueT = 0; this.seedN = 1;
    this.pendingRel = null; this.relSubject = null; this.pendingAdj = null; this.pendingGoto = false;
    this.last = null; this.lastAt = 0; this.definite = false; this.lastGroup = []; this.pendingTint = null;
    this.idN = 1; // nunca se reinicia (ni con clear): una respuesta tardía no puede resucitar un id
    this.ground = wobble([[-20, GROUND], [W + 20, GROUND]], false, rng(7), 2.5);
    this.onEvent = null; // callback opcional para subtítulos/depuración
  }

  /* ---------- construcción ---------- */
  build(item) {
    const fig = FIG[item.key]; const r = rng(item.seed);
    const { x, s } = item; const y = item.base - 100 * s;
    const tf = fig.band === 'fixed' ? (p => p) : (p => [x + (p[0] - 50) * s, y + p[1] * s]);
    return tintPrims(fig.draw(), fig.main, item.tint).map(pr => { const pts = pr.pts.map(tf); return { ...pr, pts, a: wobble(pts, pr.closed, r, 2.2), b: wobble(pts, pr.closed, r, 3) }; });
  }
  rebuild(item, now) { item.prims = this.build(item); item.half = 50 * item.s; item.born = now; }

  queueTime() { const now = performance.now(); this.queueT = Math.max(this.queueT, now); const t = this.queueT; this.queueT += GAP_MS; return t; }

  // base (parte inferior de la caja) según la banda; en el cielo depende de la escala
  baseFor(key, fig, s) {
    if (fig.band === 'sky') return 60 + Math.random() * 190 + 50 * s;
    if (fig.band === 'water') return key === 'pez' ? 665 : 648;
    return fig.layer === 0 ? GROUND : GROUND + (fig.layer === 1 ? Math.random() * 12 : 6 + Math.random() * 30);
  }

  place(key, born, opts = {}) {
    const fig = FIG[key]; if (!fig) return null;
    if (fig.band === 'water' && !this.items.some(i => i.key === 'mar')) this.place('mar', born - 200);
    const meta = { id: 'e' + this.idN++, noun: opts.noun || key, tint: opts.tint || null, pending: key === '__pending' };
    if (fig.band === 'fixed') {
      if (this.items.some(i => i.key === key)) return null;
      const it = { key, ...meta, band: 'fixed', layer: -1, base: H, born, seed: this.seedN++ * 9973, x: 0, s: 1 };
      it.prims = this.build(it); this.items.push(it); return it;
    }
    const s = fig.size / 100 * (0.9 + Math.random() * 0.2) * (opts.scale || 1);
    const half = fig.size / 2 * (opts.scale || 1);
    // elegimos la x visible con más espacio libre
    let best = this.camX + W / 2, bestScore = -1e9;
    for (let t = 0; t < 16; t++) {
      const x = this.camX + half * 0.6 + Math.random() * (W - half * 1.2);
      let score = 1e4;
      for (const o of this.items) { if (o.layer < 0) continue; const d = Math.abs(o.x - x) - (o.half + half) * 0.6 - (o.band === fig.band ? 0 : 200); score = Math.min(score, d); }
      if (score > bestScore) { bestScore = score; best = x; }
    }
    const item = { key, ...meta, x: best, half, band: fig.band, layer: fig.layer ?? 2, base: this.baseFor(key, fig, s), born, s, seed: this.seedN++ * 9973 };
    item.prims = this.build(item);
    this.items.push(item);
    const movable = this.items.filter(i => i.layer >= 0);
    if (movable.length > 18) this.items.splice(this.items.indexOf(movable[0]), 1);
    return item;
  }

  /* ---------- relaciones ---------- */
  // again = re-anclaje tras sustituir un pendiente: no vuelve a encoger "dentro" ni reinicia el trazo
  relate(A, B, rel, now, again = false) {
    if (!A || !B || A === B || A.band === 'fixed' || B.band === 'fixed') return;
    A.rel = { to: B.id, rel }; // se recuerda para re-anclar si A o B era un pendiente
    const topB = B.base - 100 * B.s;
    if (rel === 'sobre') { A.x = B.x; A.base = topB + 6 * B.s; A.layer = B.layer + 0.5; }
    else if (rel === 'debajo') { A.x = B.x; A.base = B.band === 'sky' ? GROUND + 12 : B.base + 8; A.layer = B.layer + 0.5; }
    else if (rel === 'dentro') { A.x = B.x; if (!again) A.s *= 0.55; A.base = B.base - 4; A.layer = B.layer + 0.5; }
    else { // junto
      const side = (A.x < B.x) ? -1 : 1;
      A.x = B.x + side * (A.half + B.half) * 0.95;
      if (A.band === B.band && A.band === 'ground') A.base = B.base + 4;
    }
    if (A.base - 100 * A.s < 12) A.base = 12 + 100 * A.s; // que no se salga por arriba
    if (again) { A.prims = this.build(A); A.half = 50 * A.s; } else this.rebuild(A, now);
  }

  /* ---------- entrada de eventos ---------- */
  handle(ev) {
    const now = performance.now();
    if (ev.kind === 'noun') return this.noun(ev, now);
    if (ev.kind === 'art') { this.definite = true; return; }
    if (ev.kind === 'prep') { if (this.last && now - this.lastAt < 6000) { this.pendingRel = ev.key; this.relSubject = this.last; } return; }
    if (ev.kind === 'adj') {
      if (this.last && now - this.lastAt < WINDOW_MS && this.last.band !== 'fixed') { this.last.s *= ev.scale; this.rebuild(this.last, now); }
      else this.pendingAdj = ev.scale;
      return;
    }
    if (ev.kind === 'color') { // tiñe el último grupo ("dos gatos rojos") o espera al siguiente sustantivo
      if (this.last && now - this.lastAt < WINDOW_MS && this.last.band !== 'fixed') {
        for (const it of this.lastGroup) if (it.band !== 'fixed') { it.tint = ev.key; it.prims = this.build(it); }
      } else this.pendingTint = ev.key;
      return;
    }
    if (ev.kind === 'cmd') return this.cmd(ev.key);
  }

  noun(ev, now) {
    const k = ev.key;
    if (k === '@noche') { this.night = true; return; }
    if (k === '@dia') { this.night = false; return; }
    if (k === '@bosque') { for (let i = 0; i < 3; i++) this.place('arbol', this.queueTime()); return; }
    if (k === '@jardin') { for (let i = 0; i < 3; i++) this.place('flor', this.queueTime()); return; }
    this.spawn(k, k, ev.plural, now);
  }

  // sustantivo desconocido: marcador '__pending' con la misma lógica que un sustantivo local
  addPending(concept, { plural = false } = {}) { return this.spawn('__pending', concept, plural, performance.now()); }

  // coloca n figuras `k` para el concepto `noun`; devuelve los ids creados ([] si sólo se referencia uno existente)
  spawn(k, noun, plural, now) {
    const definite = this.definite; this.definite = false;
    const existing = [...this.items].reverse().find(i => i.noun === noun && i.band !== 'fixed' && !i.fadeAt);
    // "camino hacia la casa": si ya existe, la cámara va hacia ella en vez de dibujar otra
    if (this.pendingGoto) {
      this.pendingGoto = false;
      if (existing) { this.camTarget = existing.x - W / 2; this.last = existing; this.lastGroup = [existing]; this.lastAt = now; this.pendingRel = null; return []; }
      // no existe: la dibujamos un poco más allá y viajamos hasta ella
      this.camTarget = this.camX + W * 0.8;
    }
    // "el gato", "junto al dragón": nos referimos al que ya está dibujado
    if (definite && existing) {
      if (this.pendingRel && this.relSubject && this.relSubject !== existing && this.items.includes(this.relSubject)) this.relate(this.relSubject, existing, this.pendingRel, now);
      this.pendingRel = null; this.relSubject = null; this.pendingAdj = null; this.pendingTint = null;
      this.last = existing; this.lastGroup = [existing]; this.lastAt = now; return [];
    }
    const n = plural ? (k === 'estrella' || k === 'flor' ? 4 : 2) : 1;
    const group = [];
    for (let i = 0; i < n; i++) { const it = this.place(k, this.queueTime(), { scale: this.pendingAdj || 1, noun, tint: this.pendingTint }); if (it) group.push(it); }
    this.pendingAdj = null; this.pendingTint = null;
    const item = group[group.length - 1];
    if (item) {
      if (this.pendingRel && this.relSubject && this.items.includes(this.relSubject)) this.relate(this.relSubject, item, this.pendingRel, now);
      this.pendingRel = null; this.relSubject = null;
      this.last = item; this.lastGroup = group; this.lastAt = now;
    }
    return group.map(i => i.id);
  }

  // llega la figura: se sustituye en el mismo x, con la escala y el tinte pedidos, y se vuelve a trazar
  resolvePending(ids, figKey) {
    const fig = FIG[figKey]; if (!fig || fig.band === 'fixed') return this.dropPending(ids); // nunca se queda colgado
    const now = performance.now();
    const byId = id => this.items.find(i => i.id === id);
    for (const it of this.items.filter(i => i.pending && !i.fadeAt && ids.includes(i.id))) {
      const ratio = it.s / (FIG.__pending.size / 100); // escala pedida (azar, "grande", "dentro"…)
      if (fig.band === 'water' && !this.items.some(i => i.key === 'mar')) this.place('mar', now - 200);
      it.key = figKey; it.pending = false; it.s = fig.size / 100 * ratio;
      it.band = fig.band; it.layer = fig.layer ?? 2; it.base = this.baseFor(figKey, fig, it.s);
      if (it.band === 'sky' && it.base - 100 * it.s < 12) it.base = 12 + 100 * it.s; // que no se salga por arriba
      this.rebuild(it, now);
      // relaciones: si era sujeto se vuelve a colocar junto a su destino; si era destino, se re-anclan sus sujetos
      const to = it.rel && byId(it.rel.to); if (to) this.relate(it, to, it.rel.rel, now, true);
      for (const o of this.items) if (o !== it && o.rel && o.rel.to === it.id) this.relate(o, it, o.rel.rel, now, true);
    }
  }

  // no hay figura (no dibujable, bloqueada, error, 8 s): el garabato se desvanece y frame lo quita
  dropPending(ids) {
    const now = performance.now();
    for (const it of this.items) if (it.pending && !it.fadeAt && ids.includes(it.id)) it.fadeAt = now;
  }

  sweep(now) {
    const gone = this.items.filter(i => i.fadeAt && now - i.fadeAt >= FADE_MS); if (!gone.length) return;
    this.items = this.items.filter(i => !gone.includes(i));
    this.lastGroup = this.lastGroup.filter(i => !gone.includes(i));
    if (gone.includes(this.last)) this.last = null;
    if (gone.includes(this.relSubject)) { this.relSubject = null; this.pendingRel = null; }
  }

  cmd(c) {
    if (c === 'left') this.camTarget -= W * 0.5;
    else if (c === 'right') this.camTarget += W * 0.5;
    else if (c === 'goto') this.pendingGoto = true;
    else if (c === 'far') this.pendingAdj = 0.55;
    else if (c === 'back') this.camTarget = 0;
  }

  clear() { this.items = []; this.night = false; this.camX = 0; this.camTarget = 0; this.queueT = 0; this.pendingRel = null; this.relSubject = null; this.pendingAdj = null; this.pendingGoto = false; this.last = null; this.lastGroup = []; this.pendingTint = null; this.definite = false; }

  /* ---------- dibujo ---------- */
  strokePart(ctx, pts, frac, color, width) {
    if (frac <= 0) return;
    let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let lim = total * Math.min(1, frac);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length && lim > 0; i++) {
      const a = pts[i - 1], b = pts[i]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= lim) { ctx.lineTo(b[0], b[1]); lim -= d; } else { const t = lim / d; ctx.lineTo(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t); lim = 0; }
    }
    ctx.stroke();
  }

  drawItem(ctx, it, now, ink) {
    const p = (now - it.born - (it.pending ? SCRIBBLE_MS : 0)) / DRAW_MS; if (p <= 0) return;
    const k = it.fadeAt ? Math.max(0, 1 - (now - it.fadeAt) / FADE_MS) : 1; if (k <= 0) return;
    for (const pr of it.prims) {
      if (pr.fill) {
        ctx.globalAlpha = k * Math.max(0, Math.min(1, (p - 0.35) / 0.4));
        ctx.fillStyle = pr.fill; ctx.beginPath();
        pr.pts.forEach((q, i) => i ? ctx.lineTo(q[0] + 3, q[1] + 2) : ctx.moveTo(q[0] + 3, q[1] + 2));
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (pr.nostroke) continue;
      const c = pr.color && !pr.fill ? pr.color : ink;
      ctx.globalAlpha = .85 * k; this.strokePart(ctx, pr.a, p / 0.6, c, 2.4);
      ctx.globalAlpha = .35 * k; this.strokePart(ctx, pr.b, (p - 0.1) / 0.6, c, 1.4);
      ctx.globalAlpha = 1;
    }
  }

  frame(ctx, now) {
    this.sweep(now);
    this.nightMix += ((this.night ? 1 : 0) - this.nightMix) * 0.06;
    this.camX += (this.camTarget - this.camX) * 0.08;
    const paper = mixHex('#fbfaf6', '#26304a', this.nightMix), ink = mixHex('#2b2a33', '#ece8dc', this.nightMix);
    ctx.fillStyle = paper; ctx.fillRect(0, 0, W, H);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const sorted = [...this.items].sort((a, b) => a.layer - b.layer || a.base - b.base);
    // fondo fijo (mar) en coordenadas de pantalla
    for (const it of sorted) if (it.layer < 0) this.drawItem(ctx, it, now, ink);
    ctx.globalAlpha = .45; this.strokePart(ctx, this.ground, 1, ink, 2); ctx.globalAlpha = 1;
    // escena en coordenadas de mundo (cámara)
    ctx.save(); ctx.translate(-this.camX, 0);
    for (const it of sorted) if (it.layer >= 0) this.drawItem(ctx, it, now, ink);
    ctx.restore();
  }
}
