import { CHARSET, COLOR, glyph, hash2, pick } from "./glyphs";

export type Rect = { x: number; y: number; w: number; h: number };

/** Per-particle random seeds, fixed for the life of the field. */
export type Seeds = {
  r0: Float32Array;
  r1: Float32Array;
  r2: Float32Array;
  r3: Float32Array;
  r4: Float32Array;
  r5: Float32Array;
};

export type SceneCtx = {
  /** Stage size in CSS px. */
  w: number;
  h: number;
  /** Seconds since the field started. */
  t: number;
  /** How far the stage has risen into view, 0..1 (drives "build" effects). */
  q: number;
  vw: number;
  vh: number;
  /** Character cell size in CSS px, for shapes that should sit on whole rows/columns. */
  cell: number;
  cellW: number;
  /** Where the character grid falls inside the stage (px past the last grid line). */
  rowOffset: number;
  colOffset: number;
  /** Child anchors measured relative to the stage's top-left corner. */
  anchors: Map<string, Rect>;
};

/** Particle target in stage-local px plus how to draw it. */
export type Out = { x: number; y: number; g: number; c: number; a: number };

export type SceneInstance = {
  prepare(k: SceneCtx): void;
  sample(i: number, s: Seeds, k: SceneCtx, o: Out): void;
};

const TAU = Math.PI * 2;
const { lavender: LAV, gold: GOLD, mist: MIST, muted: MUTED } = COLOR;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const frac = (v: number) => v - Math.floor(v);

type Point = { x: number; y: number };
const tmp: Point = { x: 0, y: 0 };

function bezier(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  t: number, out: Point,
) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out.x = a * x0 + b * x1 + c * x2 + d * x3;
  out.y = a * y0 + b * y1 + c * y2 + d * y3;
}

/** Point on a cubic plus a sideways offset (perpendicular to the curve). */
function bezierOffset(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  t: number, offset: number, out: Point,
) {
  bezier(x0, y0, x1, y1, x2, y2, x3, y3, t, out);
  bezier(x0, y0, x1, y1, x2, y2, x3, y3, Math.min(1, t + 0.015), tmp);
  const tx = tmp.x - out.x;
  const ty = tmp.y - out.y;
  const len = Math.hypot(tx, ty) || 1;
  out.x += (-ty / len) * offset;
  out.y += (tx / len) * offset;
}

/* -------------------------------------------------------------------------- */
/* Hero: three input streams converge into one ring ("Connected intelligence") */
/* -------------------------------------------------------------------------- */
function converge(): SceneInstance {
  const sx = [0, 0, 0];
  const sy = [0, 0, 0];
  const ex = [0, 0, 0];
  const ey = [0, 0, 0];
  let ncx = 0;
  let ncy = 0;
  let radius = 0;
  let bx = 0;
  let by = 0;
  let ox = 0;
  let oy = 0;

  return {
    prepare(k) {
      const node = k.anchors.get("node");
      ncx = node ? node.x + node.w / 2 : k.w * 0.76;
      ncy = node ? node.y + node.h / 2 : k.h * 0.5;
      radius = node ? node.w / 2 : k.w * 0.21;
      for (let j = 0; j < 3; j++) {
        const input = k.anchors.get(`in${j}`);
        sx[j] = input ? input.x + input.w + 6 : k.w * 0.3;
        sy[j] = input ? input.y + input.h / 2 : k.h * (0.32 + 0.18 * j);
        const angle = Math.PI + (j - 1) * 0.62;
        ex[j] = ncx + Math.cos(angle) * radius;
        ey[j] = ncy + Math.sin(angle) * radius;
      }
      const angle = Math.PI * 0.5 - 0.4;
      bx = ncx + Math.cos(angle) * radius;
      by = ncy + Math.sin(angle) * radius;
      const out = k.anchors.get("out");
      ox = out ? out.x + out.w * 0.25 : k.w * 0.82;
      oy = out ? out.y - 6 : k.h * 0.92;
    },
    sample(i, s, k, o) {
      const r0 = s.r0[i];
      const t = k.t;

      if (r0 < 0.6) {
        const j = Math.min(2, ((r0 / 0.6) * 3) | 0);
        const p = frac(s.r1[i] + t * (0.05 + s.r2[i] * 0.05));
        const mx = sx[j] + (ex[j] - sx[j]) * 0.5;
        const spread = (s.r3[i] - 0.5) * 2 * (12 * (1 - p) + 2);
        bezierOffset(sx[j], sy[j], mx, sy[j], mx, ey[j], ex[j], ey[j], p, spread, o);
        const tick = Math.floor(t * (1.5 + s.r4[i] * 5) + s.r5[i] * 10);
        o.g = p < 0.38 ? pick(CHARSET.noise, i, tick) : pick(CHARSET.bits, i, tick);
        if (s.r5[i] < 0.07) {
          o.c = GOLD;
          o.a = 1;
        } else {
          o.c = LAV;
          o.a = 0.42 + 0.55 * p;
        }
        return;
      }

      if (r0 < 0.84) {
        if (s.r1[i] < 0.66) {
          // Outer band: a few glyphs thick, brightest on its centre line.
          const angle = s.r2[i] * TAU + t * 0.1;
          const band = (s.r3[i] - 0.5) * 2;
          const r = radius + band * 9;
          o.x = ncx + Math.cos(angle) * r;
          o.y = ncy + Math.sin(angle) * r;
          o.g = Math.abs(band) < 0.4
            ? pick(CHARSET.dense, i, Math.floor(t * 0.8 + s.r4[i] * 7))
            : pick(CHARSET.ring, i, Math.floor(t * 0.8 + s.r4[i] * 7));
          o.c = s.r5[i] < 0.08 ? GOLD : LAV;
          o.a = 0.95 - Math.abs(band) * 0.4;
        } else {
          let angle = s.r2[i] * TAU;
          const seg = TAU / 22;
          const f = frac(angle / seg);
          if (f > 0.55) angle -= (f - 0.55) * seg;
          angle -= t * 0.07;
          const r = radius * 0.84;
          o.x = ncx + Math.cos(angle) * r;
          o.y = ncy + Math.sin(angle) * r;
          o.g = glyph(".");
          o.c = LAV;
          o.a = 0.55;
        }
        return;
      }

      if (r0 < 0.92) {
        const p = frac(s.r1[i] + t * 0.22);
        bezier(bx, by, bx, by + (oy - by) * 0.7, ox - (ox - bx) * 0.3, oy, ox, oy, p, o);
        o.g = pick(CHARSET.bits, i, Math.floor(t * 4 + s.r3[i] * 9));
        o.c = s.r3[i] < 0.3 ? GOLD : LAV;
        o.a = 0.35 + 0.55 * p;
        return;
      }

      const dir = s.r4[i] < 0.5 ? 1 : -1;
      const angle = s.r2[i] * TAU + t * (0.16 + s.r3[i] * 0.22) * dir;
      const r = radius * (1.12 + s.r1[i] * 0.45);
      o.x = ncx + Math.cos(angle) * r;
      o.y = ncy + Math.sin(angle) * r;
      o.g = pick(CHARSET.dust, i, Math.floor(t * 0.5 + s.r5[i] * 5));
      o.c = MUTED;
      o.a = 0.2 + 0.28 * (1 - s.r1[i]);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Intro: a double helix, printed into place as the section scrolls in        */
/* -------------------------------------------------------------------------- */
function helix(): SceneInstance {
  let vertical = true;
  let start = 0;
  let length = 0;
  let center = 0;
  let amp = 0;
  let turns = 0;
  let rungs = 0;

  return {
    prepare(k) {
      vertical = k.h >= k.w * 0.8;
      const along = vertical ? k.h : k.w;
      const across = vertical ? k.w : k.h;
      start = along * 0.06;
      length = along * 0.88;
      center = across / 2;
      amp = Math.min(across * 0.36, 130);
      turns = length / (amp * 3);
      rungs = Math.max(6, Math.floor(length / (vertical ? 28 : 24)));
    },
    sample(i, s, k, o) {
      const r0 = s.r0[i];
      const t = k.t;
      const front = k.q * 1.12;
      const strand = r0 < 0.66;
      const n = Math.min(rungs - 1, Math.floor(s.r1[i] * rungs));
      const v = strand ? s.r1[i] : (n + 0.5) / rungs;
      let along = 0;
      let across = 0;

      if (v > front) {
        // The "print head": unbuilt particles wait at the growing tip.
        const tip = Math.min(front, 1);
        along = start + tip * length + (s.r4[i] - 0.5) * 8;
        across = center + Math.sin(tip * turns * TAU + t * 0.7) * amp + (s.r3[i] - 0.5) * 16;
        o.g = pick(CHARSET.noise, i, Math.floor(t * 14 + s.r5[i] * 9));
        o.c = s.r5[i] < 0.25 ? GOLD : MIST;
        o.a = 0.85;
      } else if (strand) {
        const phase = v * turns * TAU + t * 0.7 + (r0 < 0.33 ? 0 : Math.PI);
        const depth = (Math.cos(phase) + 1) / 2;
        // Strands are a few glyphs thick, thicker on the near side for depth.
        across = center + Math.sin(phase) * amp + (s.r3[i] - 0.5) * (8 + 12 * depth);
        along = start + v * length;
        const tick = Math.floor(t * 0.7 + s.r4[i] * 6);
        o.g = depth > 0.6 ? pick(CHARSET.dense, i, tick) : pick(CHARSET.light, i, tick);
        o.c = s.r5[i] < 0.06 ? GOLD : LAV;
        o.a = 0.22 + 0.68 * depth;
      } else {
        // Rungs: base pairs (A-T / C-G) bridging the two strands.
        const phase = v * turns * TAU + t * 0.7;
        const offset = Math.sin(phase) * amp;
        const u = s.r2[i];
        across = center + offset * (1 - 2 * u);
        along = start + v * length;
        const pair = hash2(n, 7) & 1 ? "AT" : "CG";
        const flip = (hash2(n, 11) & 1) === 1;
        if (u < 0.08 || u > 0.92) {
          o.g = glyph(pair[(u < 0.5) !== flip ? 0 : 1]);
          o.c = MIST;
          o.a = 0.5 + 0.35 * Math.abs(Math.sin(phase));
        } else {
          o.g = glyph(vertical ? "-" : "|");
          o.c = MUTED;
          o.a = 0.25 + 0.3 * Math.abs(Math.sin(phase));
        }
      }

      o.x = vertical ? across : along;
      o.y = vertical ? along : across;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Approach: five noisy clusters stream into one core, then one clean line    */
/* -------------------------------------------------------------------------- */
const chipFallback = [
  [0.03, 0.07], [0.14, 0.25], [0.03, 0.45], [0.15, 0.66], [0.04, 0.84],
];

function cluster(): SceneInstance {
  const cx = new Float32Array(5);
  const cy = new Float32Array(5);
  const cw = new Float32Array(5);
  const chh = new Float32Array(5);
  const sx = new Float32Array(5);
  const sy = new Float32Array(5);
  let ccx = 0;
  let ccy = 0;
  let cr = 0;
  let horizontal = true;
  let lx0 = 0;
  let ly0 = 0;
  let lx1 = 0;
  let ly1 = 0;

  return {
    prepare(k) {
      const core = k.anchors.get("core");
      ccx = core ? core.x + core.w / 2 : k.w * 0.525;
      ccy = core ? core.y + core.h / 2 : k.h * 0.5;
      cr = core ? core.w / 2 : 50;
      const result = k.anchors.get("result");
      horizontal = result ? result.x > ccx + cr : true;
      if (horizontal) {
        lx0 = ccx + cr + 10;
        ly0 = ccy;
        lx1 = result ? result.x - 10 : k.w * 0.66;
        ly1 = ccy;
      } else {
        lx0 = ccx;
        ly0 = ccy + cr + 36;
        lx1 = ccx;
        ly1 = result ? result.y - 10 : k.h * 0.8;
      }
      for (let j = 0; j < 5; j++) {
        const chip = k.anchors.get(`chip${j}`);
        const w = chip ? chip.w : 110;
        const h = chip ? chip.h : 36;
        const x = chip ? chip.x : chipFallback[j][0] * k.w;
        const y = chip ? chip.y : chipFallback[j][1] * k.h;
        cx[j] = x + w / 2;
        cy[j] = y + h / 2;
        cw[j] = w;
        chh[j] = h;
        const towardRight = ccx - cx[j] > Math.abs(ccy - cy[j]) * 0.6;
        sx[j] = towardRight ? x + w + 4 : cx[j];
        sy[j] = towardRight ? cy[j] : y + h + 4;
      }
    },
    sample(i, s, k, o) {
      const r0 = s.r0[i];
      const t = k.t;
      const grow = k.q * 1.7;

      const ring = () => {
        if (s.r1[i] < 0.7) {
          const angle = s.r2[i] * TAU + t * 0.14;
          const band = (s.r3[i] - 0.5) * 2;
          const r = cr + band * 7;
          o.x = ccx + Math.cos(angle) * r;
          o.y = ccy + Math.sin(angle) * r;
          o.g = Math.abs(band) < 0.4
            ? pick(CHARSET.dense, i, Math.floor(t + s.r4[i] * 7))
            : pick(CHARSET.ring, i, Math.floor(t + s.r4[i] * 7));
          o.c = s.r5[i] < 0.1 ? GOLD : LAV;
          o.a = 0.95 - Math.abs(band) * 0.35;
        } else {
          const pulse = frac(t * 0.33 + s.r3[i] * 0.15);
          const angle = s.r2[i] * TAU;
          const r = cr * (1.05 + pulse * 0.6);
          o.x = ccx + Math.cos(angle) * r;
          o.y = ccy + Math.sin(angle) * r;
          o.g = glyph(".");
          o.c = LAV;
          o.a = 0.6 * (1 - pulse);
        }
      };

      if (r0 < 0.62) {
        const streaming = r0 >= 0.28;
        const j = streaming
          ? Math.min(4, (((r0 - 0.28) / 0.34) * 5) | 0)
          : Math.min(4, ((r0 / 0.28) * 5) | 0);
        if (streaming) {
          const p = frac(s.r1[i] + t * (0.07 + s.r2[i] * 0.06));
          if (p <= clamp01(grow - 0.2 - j * 0.06)) {
            const dx = ccx - sx[j];
            const dy = ccy - sy[j];
            const len = Math.hypot(dx, dy) || 1;
            const ex = ccx - (dx / len) * cr;
            const ey = ccy - (dy / len) * cr;
            const spread = (s.r3[i] - 0.5) * 2 * 8 * (1 - p);
            const towardRight = sx[j] !== cx[j];
            if (towardRight) {
              const mx = sx[j] + (ex - sx[j]) * 0.5;
              bezierOffset(sx[j], sy[j], mx, sy[j], mx, ey, ex, ey, p, spread, o);
            } else {
              const my = sy[j] + (ey - sy[j]) * 0.5;
              bezierOffset(sx[j], sy[j], sx[j], my, ex, my, ex, ey, p, spread, o);
            }
            const tick = Math.floor(t * 3 + s.r4[i] * 9);
            o.g = p < 0.4 ? pick(CHARSET.noise, i, tick) : pick(CHARSET.bits, i, tick);
            o.c = LAV;
            o.a = 0.3 + 0.45 * p;
            return;
          }
        }
        const angle = s.r1[i] * TAU + t * (s.r2[i] - 0.5) * 0.8;
        const tick = Math.floor(t * 7 + s.r3[i] * 5);
        const jx = ((hash2(i, tick) & 255) / 255 - 0.5) * 7;
        const jy = ((hash2(i, tick + 999) & 255) / 255 - 0.5) * 5;
        const rx = cw[j] * 0.5 + 6 + s.r3[i] * 22;
        const ry = chh[j] * 0.5 + 4 + s.r3[i] * 11;
        o.x = cx[j] + Math.cos(angle) * rx + jx;
        o.y = cy[j] + Math.sin(angle) * ry + jy;
        o.g = pick(CHARSET.noise, i, tick);
        o.c = MUTED;
        o.a = 0.3 + 0.35 * (1 - s.r3[i]);
        return;
      }

      if (r0 < 0.8) {
        ring();
        return;
      }

      const p = frac(s.r1[i] + t * 0.3);
      if (p > clamp01((grow - 0.85) * 2.2)) {
        ring();
        return;
      }
      o.x = lx0 + (lx1 - lx0) * p;
      o.y = ly0 + (ly1 - ly0) * p;
      const bright = frac(p * 2.5 - t * 1.2) > 0.86;
      o.g = bright ? glyph(horizontal ? ">" : "v") : glyph(horizontal ? "=" : "|");
      o.c = bright ? GOLD : LAV;
      o.a = bright ? 1 : 0.7;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Grid snapping: shapes that should read as hand-drawn ASCII sit on exact    */
/* character rows/columns instead of floating between them.                  */
/* -------------------------------------------------------------------------- */
const snapY = (k: SceneCtx, y: number) => Math.ceil((y + k.rowOffset) / k.cell) * k.cell - k.rowOffset;
const snapX = (k: SceneCtx, x: number) => Math.ceil((x + k.colOffset) / k.cellW) * k.cellW - k.colOffset;

/* -------------------------------------------------------------------------- */
/* Offer: one emblem per way of working (platform, partnership, embedding)    */
/* -------------------------------------------------------------------------- */
function offer(): SceneInstance {
  const ex = new Float32Array(3);
  const ey = new Float32Array(3);
  const ew = new Float32Array(3);
  const eh = new Float32Array(3);
  const widths = [0.44, 0.66, 0.88];

  return {
    prepare(k) {
      for (let j = 0; j < 3; j++) {
        const area = k.anchors.get(`o${j}`);
        ex[j] = area ? area.x : (k.w / 3) * j + 16;
        ey[j] = area ? area.y : 16;
        ew[j] = area ? area.w : k.w / 3 - 32;
        eh[j] = area ? area.h : 128;
      }
    },
    sample(i, s, k, o) {
      // Index-based assignment (not random) so every character cell of a shape is covered.
      const j = i % 3;
      const li = (i / 3) | 0;
      const x0 = ex[j];
      const y0 = ey[j];
      const w = ew[j];
      const h = eh[j];
      const t = k.t;
      const cw = k.cellW;
      const ch = k.cell;

      if (j === 0) {
        // Platforms: three stacked layers drawn as ASCII trays,  ____ / |____|
        const top = snapY(k, y0 + (h - 8 * ch) / 2);
        const slab = li % 3;
        const cols = Math.max(4, Math.round((w * widths[slab]) / cw));
        const left = snapX(k, x0 + (w - cols * cw) / 2 + (1 - slab) * cw);
        const cell = ((li / 3) | 0) % (cols * 2);
        const col = cell % cols;
        const row = (cell / cols) | 0;
        const edge = col === 0 || col === cols - 1;
        o.x = left + (col + 0.5) * cw;
        o.y = top + (slab * 3 + row + 0.5) * ch;
        if (row === 0 && edge) {
          o.a = 0;
          return;
        }
        const lit = Math.floor(t * 0.9) % 4 === 2 - slab;
        o.g = row === 1 && edge ? glyph("|") : glyph("_");
        o.c = lit ? GOLD : LAV;
        o.a = lit ? 0.95 : row === 1 ? 0.8 : 0.6;
        return;
      }

      if (j === 1) {
        // Partnership: two strands braided from a start point to a finish point.
        const xa = snapX(k, x0 + w * 0.1);
        const xb = snapX(k, x0 + w * 0.9);
        const cy = snapY(k, y0 + h / 2 - ch / 2) + ch / 2;
        const r1 = s.r1[i];
        if (r1 < 0.88) {
          const strand = r1 < 0.44 ? 0 : Math.PI;
          const u = frac(li * 0.6180339887 + (strand ? 0.5 : 0));
          const amp = Math.min(h * 0.36, 3 * ch);
          const freq = TAU * 1.5;
          const phase = u * freq + t * 1.1 + strand;
          const taper = Math.sqrt(Math.sin(u * Math.PI));
          o.x = xa + (xb - xa) * u;
          o.y = cy + Math.sin(phase) * amp * taper;
          const slope = (Math.cos(phase) * freq * amp * taper) / ((xb - xa) * 2);
          const pulse = frac(u - t * 0.2) < 0.05;
          o.g = pulse
            ? glyph("*")
            : Math.abs(slope) < 0.3
              ? glyph(Math.sin(phase) > 0 ? "_" : "-")
              : glyph(slope > 0 ? "\\" : "/");
          o.c = pulse ? GOLD : strand ? MIST : LAV;
          o.a = pulse ? 1 : 0.72;
        } else if (r1 < 0.94) {
          o.x = xa - cw * 0.5;
          o.y = cy;
          o.g = glyph("o");
          o.c = LAV;
          o.a = 0.95;
        } else {
          o.x = xb + cw * 0.5;
          o.y = cy;
          o.g = glyph("@");
          o.c = GOLD;
          o.a = 1;
        }
        return;
      }

      // Embedding: a team of blocks, one engineer slotting into the gap.
      const totalCols = Math.floor(w / cw);
      const bw = Math.max(3, Math.min(6, Math.floor((totalCols - 4) / 5) - 1));
      const gap = 2;
      const gridW = 5 * bw + 4 * gap;
      const left = snapX(k, x0 + (w - gridW * cw) / 2);
      const top = snapY(k, y0 + (h - 5 * ch) / 2);
      const b = li % 15;
      const col = ((li / 15) | 0) % bw;
      let x = left + ((b % 5) * (bw + gap) + col + 0.5) * cw;
      let y = top + (((b / 5) | 0) * 2 + 0.5) * ch;
      const bracket = col === 0 ? "[" : col === bw - 1 ? "]" : "";
      if (b === 7) {
        const cycle = frac(t / 4.8);
        const eased = 1 - Math.pow(1 - clamp01(cycle / 0.35), 3);
        y -= (1 - eased) * h * 0.7;
        x += (1 - eased) * cw * 3;
        o.g = glyph(bracket || "#");
        o.c = GOLD;
        o.a = cycle > 0.92 ? 1 - (cycle - 0.92) / 0.08 : 1;
      } else {
        o.g = glyph(bracket || "=");
        o.c = LAV;
        o.a = bracket ? 0.6 : 0.4;
      }
      o.x = x;
      o.y = y;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Industries: a 3x3 matrix of ASCII boxes, one lit at a time                 */
/* -------------------------------------------------------------------------- */
function matrix(): SceneInstance {
  const tileCols = 7;
  const gapCols = 2;
  let top = 0;
  let left = 0;

  return {
    prepare(k) {
      top = snapY(k, (k.h - 8 * k.cell) / 2);
      left = snapX(k, 0);
    },
    sample(i, s, k, o) {
      const tile = i % 9;
      const li = (i / 9) | 0;
      const col = li % tileCols;
      const row = ((li / tileCols) | 0) % 2;
      const edge = col === 0 || col === tileCols - 1;
      const active = tile === Math.floor(k.t * 0.9) % 9;
      o.x = left + ((tile % 3) * (tileCols + gapCols) + col + 0.5) * k.cellW;
      o.y = top + (((tile / 3) | 0) * 3 + row + 0.5) * k.cell;
      if (row === 0 && edge) {
        o.a = 0;
        return;
      }
      if (row === 1 && !edge && active) {
        o.g = pick(CHARSET.dense, i, Math.floor(k.t * 8));
      } else {
        o.g = glyph(row === 1 && edge ? "|" : "_");
      }
      o.c = active ? GOLD : LAV;
      o.a = active ? 1 : 0.5;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Contact: everything spirals into one blinking cursor                       */
/* -------------------------------------------------------------------------- */
function collapse(): SceneInstance {
  let px = 0;
  let py = 0;
  let maxR = 0;

  return {
    prepare(k) {
      const cursor = k.anchors.get("cursor");
      px = cursor ? cursor.x + cursor.w / 2 : k.w;
      py = cursor ? cursor.y + cursor.h / 2 : k.h / 2;
      maxR = Math.max(k.vw, k.vh) * 0.6;
    },
    sample(i, s, k, o) {
      // Stays wide while the section arrives, then pulls in fast at the very end.
      const x = clamp01((k.q - 0.3) / 0.7);
      const shrink = 1 - x * x * (3 - 2 * x);
      const base = 0.12 + 0.88 * Math.pow(s.r1[i], 0.6);
      const r = maxR * base * shrink;
      const angle = s.r2[i] * TAU + k.t * (0.12 + 0.45 / (0.2 + base));
      o.x = px + Math.cos(angle) * r;
      o.y = py + Math.sin(angle) * r * 0.36;
      const tick = Math.floor(k.t * 4 + s.r4[i] * 9);
      o.g = base > 0.55 ? pick(CHARSET.noise, i, tick) : pick(CHARSET.bits, i, tick);
      o.c = s.r3[i] < 0.1 ? GOLD : LAV;
      // A clear eye around the cursor keeps the heading readable.
      const eye = clamp01((r - 70) / 110);
      o.a = (0.13 + 0.3 * (1 - base)) * eye;
    },
  };
}

export const SCENES: Record<string, () => SceneInstance> = {
  converge,
  helix,
  cluster,
  offer,
  matrix,
  collapse,
};
