// Motor de escena: coloca figuras en bandas (cielo / suelo / mar), las dibuja con trazo
// de lápiz animado y relleno plano, y entiende relaciones ("sobre", "junto a"),
// tamaños ("grande") y cámara por voz ("miro a la izquierda", "camino hacia la casa").
import { FIG, P, W, H, GROUND } from './figures';

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

export class Scene {
  constructor() {
    this.items = []; this.night = false; this.nightMix = 0;
    this.camX = 0; this.camTarget = 0; this.queueT = 0; this.seedN = 1;
    this.pendingRel = null; this.relSubject = null; this.pendingAdj = null; this.pendingGoto = false;
    this.last = null; this.lastAt = 0; this.definite = false;
    this.ground = wobble([[-20, GROUND], [W + 20, GROUND]], false, rng(7), 2.5);
    this.onEvent = null; // callback opcional para subtítulos/depuración
  }

  /* ---------- construcción ---------- */
  build(item) {
    const fig = FIG[item.key]; const r = rng(item.seed);
    const { x, s } = item; const y = item.base - 100 * s;
    const tf = fig.band === 'fixed' ? (p => p) : (p => [x + (p[0] - 50) * s, y + p[1] * s]);
    return fig.draw().map(pr => { const pts = pr.pts.map(tf); return { ...pr, pts, a: wobble(pts, pr.closed, r, 2.2), b: wobble(pts, pr.closed, r, 3) }; });
  }
  rebuild(item, now) { item.prims = this.build(item); item.half = 50 * item.s; item.born = now; }

  queueTime() { const now = performance.now(); this.queueT = Math.max(this.queueT, now); const t = this.queueT; this.queueT += GAP_MS; return t; }

  place(key, born, opts = {}) {
    const fig = FIG[key]; if (!fig) return null;
    if (fig.band === 'water' && !this.items.some(i => i.key === 'mar')) this.place('mar', born - 200);
    if (fig.band === 'fixed') {
      if (this.items.some(i => i.key === key)) return null;
      const it = { key, band: 'fixed', layer: -1, base: H, born, seed: this.seedN++ * 9973, x: 0, s: 1 };
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
    let base, layer = fig.layer ?? 2;
    if (fig.band === 'sky') base = 60 + Math.random() * 190;
    else if (fig.band === 'water') base = key === 'pez' ? 665 : 648;
    else base = fig.layer === 0 ? GROUND : GROUND + (fig.layer === 1 ? Math.random() * 12 : 6 + Math.random() * 30);
    const item = { key, x: best, half, band: fig.band, layer, base, born, s, seed: this.seedN++ * 9973 };
    if (fig.band === 'sky') item.base = base + 50 * s; // base = parte inferior de la caja
    item.prims = this.build(item);
    this.items.push(item);
    const movable = this.items.filter(i => i.layer >= 0);
    if (movable.length > 18) this.items.splice(this.items.indexOf(movable[0]), 1);
    return item;
  }

  /* ---------- relaciones ---------- */
  relate(A, B, rel, now) {
    if (!A || !B || A === B || A.band === 'fixed' || B.band === 'fixed') return;
    const topB = B.base - 100 * B.s;
    if (rel === 'sobre') { A.x = B.x; A.base = topB + 6 * B.s; A.layer = B.layer + 0.5; }
    else if (rel === 'debajo') { A.x = B.x; A.base = B.band === 'sky' ? GROUND + 12 : B.base + 8; A.layer = B.layer + 0.5; }
    else if (rel === 'dentro') { A.x = B.x; A.s *= 0.55; A.base = B.base - 4; A.layer = B.layer + 0.5; }
    else { // junto
      const side = (A.x < B.x) ? -1 : 1;
      A.x = B.x + side * (A.half + B.half) * 0.95;
      if (A.band === B.band && A.band === 'ground') A.base = B.base + 4;
    }
    if (A.base - 100 * A.s < 12) A.base = 12 + 100 * A.s; // que no se salga por arriba
    this.rebuild(A, now);
  }

  /* ---------- entrada de eventos ---------- */
  handle(ev) {
    const now = performance.now();
    if (ev.kind === 'noun') return this.noun(ev, now);
    if (ev.kind === 'art') { this.definite = true; return; }
    if (ev.kind === 'prep') { if (this.last && now - this.lastAt < 6000) { this.pendingRel = ev.key; this.relSubject = this.last; } return; }
    if (ev.kind === 'adj') {
      if (this.last && now - this.lastAt < 3000 && this.last.band !== 'fixed') { this.last.s *= ev.scale; this.rebuild(this.last, now); }
      else this.pendingAdj = ev.scale;
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
    const definite = this.definite; this.definite = false;
    const existing = [...this.items].reverse().find(i => i.key === k && i.band !== 'fixed');
    // "camino hacia la casa": si ya existe, la cámara va hacia ella en vez de dibujar otra
    if (this.pendingGoto) {
      this.pendingGoto = false;
      if (existing) { this.camTarget = existing.x - W / 2; this.last = existing; this.lastAt = now; this.pendingRel = null; return; }
      // no existe: la dibujamos un poco más allá y viajamos hasta ella
      this.camTarget = this.camX + W * 0.8;
    }
    // "el gato", "junto al dragón": nos referimos al que ya está dibujado
    if (definite && existing) {
      if (this.pendingRel && this.relSubject && this.relSubject !== existing && this.items.includes(this.relSubject)) this.relate(this.relSubject, existing, this.pendingRel, now);
      this.pendingRel = null; this.relSubject = null; this.pendingAdj = null;
      this.last = existing; this.lastAt = now; return;
    }
    const n = ev.plural ? (k === 'estrella' || k === 'flor' ? 4 : 2) : 1;
    let item = null;
    for (let i = 0; i < n; i++) item = this.place(k, this.queueTime(), { scale: this.pendingAdj || 1 }) || item;
    this.pendingAdj = null;
    if (item) {
      if (this.pendingRel && this.relSubject && this.items.includes(this.relSubject)) this.relate(this.relSubject, item, this.pendingRel, now);
      this.pendingRel = null; this.relSubject = null;
      this.last = item; this.lastAt = now;
    }
  }

  cmd(c) {
    if (c === 'left') this.camTarget -= W * 0.5;
    else if (c === 'right') this.camTarget += W * 0.5;
    else if (c === 'goto') this.pendingGoto = true;
    else if (c === 'far') this.pendingAdj = 0.55;
    else if (c === 'back') this.camTarget = 0;
  }

  clear() { this.items = []; this.night = false; this.camX = 0; this.camTarget = 0; this.queueT = 0; this.pendingRel = null; this.relSubject = null; this.pendingAdj = null; this.pendingGoto = false; this.last = null; this.definite = false; }

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
    const p = (now - it.born) / DRAW_MS; if (p <= 0) return;
    for (const pr of it.prims) {
      if (pr.fill) {
        ctx.globalAlpha = Math.max(0, Math.min(1, (p - 0.35) / 0.4));
        ctx.fillStyle = pr.fill; ctx.beginPath();
        pr.pts.forEach((q, i) => i ? ctx.lineTo(q[0] + 3, q[1] + 2) : ctx.moveTo(q[0] + 3, q[1] + 2));
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (pr.nostroke) continue;
      const c = pr.color && !pr.fill ? pr.color : ink;
      ctx.globalAlpha = .85; this.strokePart(ctx, pr.a, p / 0.6, c, 2.4);
      ctx.globalAlpha = .35; this.strokePart(ctx, pr.b, (p - 0.1) / 0.6, c, 1.4);
      ctx.globalAlpha = 1;
    }
  }

  frame(ctx, now) {
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
