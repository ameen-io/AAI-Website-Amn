import { CHARSET, COLOR, GLYPHS, glyph, hash2, pick } from "./glyphs";
import { SCENES, type Out, type Rect, type SceneCtx, type SceneInstance, type Seeds } from "./scenes";

/**
 * One fixed canvas behind the page content. A single pool of glyph particles
 * forms the picture for whichever stage is nearest the middle of the viewport
 * and flies to the next stage as the visitor scrolls. Particles snap to a
 * document-anchored character grid so everything reads as real ASCII.
 */

type Stage = {
  el: HTMLElement;
  scene: SceneInstance;
  anchors: Map<string, Rect>;
  ctx: SceneCtx;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Fragment = { col: number; row: number; text: string; t0: number };

const CELL_W = 8;
const CELL_H = 16;
const { lavender: LAV, gold: GOLD, mist: MIST, muted: MUTED } = COLOR;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function seedArray(n: number) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random();
  return a;
}

export class AsciiEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly atlas = document.createElement("canvas");
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  private cols = 0;
  private rows = 0;
  private fontSize = 12;
  private family = "monospace";

  private alpha = new Float32Array(0);
  private glyphs = new Uint8Array(0);
  private colors = new Uint8Array(0);
  private stamp = new Uint32Array(0);
  private touched = new Int32Array(0);
  private touchedCount = 0;
  private frameId = 0;
  private scrollY = 0;
  private firstRow = 0;
  private offsetY = 0;

  private n = 0;
  private seeds: Seeds | null = null;
  private stagger = new Float32Array(0);
  private swirl = new Float32Array(0);
  private chaosX = new Float32Array(0);
  private chaosY = new Float32Array(0);

  private stages: Stage[] = [];
  private clears: HTMLElement[] = [];
  private clearRects: Rect[] = [];
  private hero: HTMLElement | null = null;
  private fragments: Fragment[] = [];
  private nextFragment = 2.6;

  private readonly mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false, strength: 0 };
  private readonly start = performance.now();
  private raf = 0;
  private frames = 0;
  private reduced: boolean;
  private destroyed = false;
  private readonly cleanup: (() => void)[] = [];
  private readonly a: Out = { x: 0, y: 0, g: 0, c: 0, a: 0 };
  private readonly b: Out = { x: 0, y: 0, g: 0, c: 0, a: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly words: string[],
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = motion.matches;

    const fontVar = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains-mono").trim();
    this.family = fontVar ? `${fontVar}, monospace` : "monospace";

    this.resize();
    document.fonts?.load(`${this.fontSize}px ${this.family}`).then(() => {
      if (!this.destroyed) {
        this.buildAtlas();
        this.requestFrame();
      }
    });

    let resizeQueued = false;
    const onResize = () => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        if (!this.destroyed) this.resize();
      });
    };
    const onScroll = () => {
      if (this.reduced) this.requestFrame();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      this.mouse.tx = event.clientX;
      this.mouse.ty = event.clientY;
      if (!this.mouse.on) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
      }
      this.mouse.on = true;
    };
    const onLeave = () => {
      this.mouse.on = false;
    };
    const onVisibility = () => {
      if (document.hidden) this.stop();
      else this.requestFrame();
    };
    const onMotion = () => {
      this.reduced = motion.matches;
      this.requestFrame();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotion);

    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);

    this.cleanup.push(() => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
      observer.disconnect();
    });

    this.requestFrame();
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.cleanup.forEach((fn) => fn());
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private requestFrame() {
    if (!this.raf && !this.destroyed && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number) => {
    this.raf = 0;
    this.render(now);
    if (!this.reduced) this.requestFrame();
  };

  /* ------------------------------------------------------------------------ */
  /* Setup                                                                    */
  /* ------------------------------------------------------------------------ */

  private resize() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeChanged = vw !== this.vw || vh !== this.vh || dpr !== this.dpr;

    if (sizeChanged) {
      this.vw = vw;
      this.vh = vh;
      this.dpr = dpr;
      this.canvas.width = Math.round(vw * dpr);
      this.canvas.height = Math.round(vh * dpr);
      this.canvas.style.width = `${vw}px`;
      this.canvas.style.height = `${vh}px`;
      this.cols = Math.ceil(vw / CELL_W) + 1;
      this.rows = Math.ceil(vh / CELL_H) + 2;
      const cells = this.cols * this.rows;
      this.alpha = new Float32Array(cells);
      this.glyphs = new Uint8Array(cells);
      this.colors = new Uint8Array(cells);
      this.stamp = new Uint32Array(cells);
      this.touched = new Int32Array(cells);
      this.fontSize = vw < 640 ? 11 : 12.5;

      const n = vw >= 1024 ? 1700 : vw >= 640 ? 1100 : 800;
      if (n !== this.n) {
        this.n = n;
        this.seeds = {
          r0: seedArray(n),
          r1: seedArray(n),
          r2: seedArray(n),
          r3: seedArray(n),
          r4: seedArray(n),
          r5: seedArray(n),
        };
        this.stagger = seedArray(n);
        this.swirl = seedArray(n);
        this.chaosX = seedArray(n);
        this.chaosY = seedArray(n);
      }
      this.buildAtlas();
    }

    this.discover();
    this.requestFrame();
  }

  private buildAtlas() {
    const style = getComputedStyle(this.canvas);
    const palette = ["--lavender", "--gold", "--mist", "--muted"].map(
      (name) => style.getPropertyValue(name).trim() || "#a47fe3",
    );
    const cw = CELL_W * this.dpr;
    const ch = CELL_H * this.dpr;
    this.atlas.width = Math.ceil(GLYPHS.length * cw);
    this.atlas.height = Math.ceil(palette.length * ch);
    const ctx = this.atlas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.atlas.width, this.atlas.height);
    ctx.font = `500 ${this.fontSize * this.dpr}px ${this.family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    palette.forEach((color, c) => {
      ctx.fillStyle = color;
      for (let g = 1; g < GLYPHS.length; g++) {
        ctx.fillText(GLYPHS[g], g * cw + cw / 2, c * ch + ch / 2 + this.dpr * 0.5);
      }
    });
  }

  private discover() {
    const previous = new Map(this.stages.map((stage) => [stage.el, stage]));
    this.stages = [];
    document.querySelectorAll<HTMLElement>("[data-ascii-stage]").forEach((el) => {
      const kept = previous.get(el);
      if (kept) {
        this.stages.push(kept);
        return;
      }
      const factory = SCENES[el.dataset.asciiStage ?? ""];
      if (!factory) return;
      this.stages.push({
        el,
        scene: factory(),
        anchors: new Map(),
        ctx: {
          w: 0,
          h: 0,
          t: 0,
          q: 0,
          vw: 0,
          vh: 0,
          cell: CELL_H,
          cellW: CELL_W,
          rowOffset: 0,
          colOffset: 0,
          anchors: new Map(),
        },
        x: 0,
        y: 0,
        w: 0,
        h: 0,
      });
    });
    this.clears = Array.from(document.querySelectorAll<HTMLElement>("[data-ascii-clear]"));
    this.hero = document.getElementById("about");
    this.measureAnchors();
  }

  private measureAnchors() {
    for (const stage of this.stages) {
      const box = stage.el.getBoundingClientRect();
      stage.anchors.clear();
      stage.el.querySelectorAll<HTMLElement>("[data-ascii-anchor]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        stage.anchors.set(el.dataset.asciiAnchor ?? "", {
          x: r.left - box.left,
          y: r.top - box.top,
          w: r.width,
          h: r.height,
        });
      });
      stage.ctx.anchors = stage.anchors;
    }
  }

  /* ------------------------------------------------------------------------ */
  /* Frame                                                                    */
  /* ------------------------------------------------------------------------ */

  private render(now: number) {
    const t = this.reduced ? 0 : (now - this.start) / 1000;
    const vh = this.vh;
    this.scrollY = window.scrollY;
    this.firstRow = Math.floor(this.scrollY / CELL_H);
    this.offsetY = this.firstRow * CELL_H - this.scrollY;
    this.frameId = (this.frameId + 1) >>> 0 || 1;
    this.touchedCount = 0;
    if (++this.frames % 24 === 0) this.measureAnchors();

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const bottomness = clamp01(1 - (maxScroll - this.scrollY) / (vh * 0.6));

    const live: Stage[] = [];
    for (const stage of this.stages) {
      const r = stage.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      stage.x = r.left;
      stage.y = r.top;
      stage.w = r.width;
      stage.h = r.height;
      const k = stage.ctx;
      k.w = r.width;
      k.h = r.height;
      k.t = t;
      k.vw = this.vw;
      k.vh = vh;
      k.rowOffset = (((r.top + this.scrollY) % CELL_H) + CELL_H) % CELL_H;
      k.colOffset = ((r.left % CELL_W) + CELL_W) % CELL_W;
      k.q = this.reduced ? 1 : clamp01((vh * 0.95 - (r.top + r.height / 2)) / (vh * 0.45));
      live.push(stage);
    }
    if (live.length) {
      const last = live[live.length - 1].ctx;
      last.q = Math.max(last.q, bottomness);
    }

    this.clearRects.length = 0;
    for (const el of this.clears) {
      const r = el.getBoundingClientRect();
      if (r.bottom > -80 && r.top < vh + 80 && r.width > 0) {
        this.clearRects.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }

    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.22;
    m.y += (m.ty - m.y) * 0.22;
    m.strength += ((m.on && !this.reduced ? 1 : 0) - m.strength) * 0.08;

    const heroVisible = clamp01(1 - this.scrollY / (vh * 0.9));
    this.ambient(t, heroVisible);
    if (!this.reduced) this.typedFragments(t, heroVisible, live);
    if (this.reduced) this.staticParticles(live);
    else this.particles(t, live, bottomness);
    this.draw();
  }

  private put(col: number, row: number, g: number, c: number, a: number) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const idx = row * this.cols + col;
    if (this.stamp[idx] !== this.frameId) {
      this.stamp[idx] = this.frameId;
      this.alpha[idx] = a;
      this.glyphs[idx] = g;
      this.colors[idx] = c;
      this.touched[this.touchedCount++] = idx;
    } else if (a > this.alpha[idx]) {
      this.alpha[idx] = a;
      this.glyphs[idx] = g;
      this.colors[idx] = c;
    }
  }

  private putAt(x: number, y: number, g: number, c: number, a: number) {
    this.put(Math.floor(x / CELL_W), Math.floor((y + this.scrollY) / CELL_H) - this.firstRow, g, c, a);
  }

  private clearFactor(x: number, y: number) {
    let f = 1;
    for (const r of this.clearRects) {
      const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
      const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 64) {
        const v = 0.1 + 0.9 * (d / 64);
        if (v < f) f = v;
      }
    }
    return f;
  }

  /** Background layer: sparse glyphs that write themselves in and erase. */
  private ambient(t: number, heroVisible: number) {
    const base = 0.05 + 0.1 * heroVisible;
    const threshold = (0.05 + 0.035 * heroVisible) * 4294967296;
    const m = this.mouse;
    const lit = m.strength > 0.01;
    const radius = 170;
    const radius2 = radius * radius;
    const noise = CHARSET.noise;
    const flicker = Math.floor(t * 6);

    for (let r = 0; r < this.rows; r++) {
      const docRow = this.firstRow + r;
      const cy = this.offsetY + r * CELL_H + CELL_H / 2;
      const dy = cy - m.y;
      const rowLit = lit && Math.abs(dy) < radius;
      for (let c = 0; c < this.cols; c++) {
        const h = hash2(c, docRow);
        let boost = 0;
        let limit = threshold;
        if (rowLit) {
          const dx = c * CELL_W + CELL_W / 2 - m.x;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius2) {
            boost = 1 - Math.sqrt(d2) / radius;
            boost *= boost * m.strength;
            limit = threshold + boost * 0.42 * 4294967296;
          }
        }
        if (h >= limit) continue;

        const period = 2.6 + (h & 7) * 0.55;
        const phase = (((h >>> 3) & 1023) / 1024) * period;
        const tt = t + phase;
        const cycle = Math.floor(tt / period);
        const local = tt / period - cycle;
        let env = local < 0.08 ? local / 0.08 : local < 0.55 ? 1 : local < 0.65 ? (0.65 - local) / 0.1 : 0;
        if (boost > env) env = boost;
        if (env < 0.02) continue;

        let a = base * env + boost * 0.42;
        if (this.clearRects.length) a *= this.clearFactor(c * CELL_W + CELL_W / 2, cy);
        if (a < 0.015) continue;
        const g = noise[hash2(h, cycle + (boost > 0.05 ? flicker : 0)) % noise.length];
        this.put(c, r, g, boost > 0.25 ? LAV : MUTED, a);
      }
    }
  }

  /** Hero only: the messy inputs type themselves out at the edges, then scramble away. */
  private typedFragments(t: number, heroVisible: number, live: Stage[]) {
    if (this.hero && heroVisible > 0.35 && t > this.nextFragment && this.fragments.length < 2) {
      this.spawnFragment(t, this.hero.getBoundingClientRect(), live);
      this.nextFragment = t + 1.4 + Math.random() * 1.6;
    }

    const step = 0.055;
    for (let f = this.fragments.length - 1; f >= 0; f--) {
      const fragment = this.fragments[f];
      const elapsed = t - fragment.t0;
      const len = fragment.text.length;
      const hold = len * step + 2.2;
      const erase = 0.5;
      if (elapsed > hold + erase) {
        this.fragments.splice(f, 1);
        continue;
      }
      const row = fragment.row - this.firstRow;
      const typed = Math.min(len, Math.floor(elapsed / step));
      const visible = elapsed > hold ? Math.ceil(len * (1 - (elapsed - hold) / erase)) : typed;
      const alpha = 0.36 * heroVisible;
      for (let i = 0; i < visible; i++) {
        const scrambling = elapsed > hold && i >= visible - 3;
        const g = scrambling ? pick(CHARSET.noise, i + fragment.col, Math.floor(t * 20)) : glyph(fragment.text[i]);
        this.put(fragment.col + i, row, g, MUTED, alpha);
      }
      if (elapsed <= hold && Math.floor(t * 2.6) % 2 === 0) {
        this.put(fragment.col + visible, row, glyph("_"), LAV, alpha * 1.6);
      }
    }
  }

  private spawnFragment(t: number, hero: DOMRect, live: Stage[]) {
    if (!this.words.length) return;
    const text = `> ${this.words[Math.floor(Math.random() * this.words.length)]}`;
    const width = text.length * CELL_W;
    const top = Math.max(hero.top + 40, 76);
    const bottom = Math.min(hero.bottom - 40, this.vh - 24);
    if (bottom - top < 40) return;

    for (let tries = 0; tries < 16; tries++) {
      const x = 8 + Math.random() * (this.vw - width - 16);
      const y = top + Math.random() * (bottom - top);
      const box = { x: x - 20, y: y - 20, w: width + 40, h: CELL_H + 40 };
      const blocked =
        this.clearRects.some((r) => overlaps(box, r)) ||
        live.some((s) => overlaps(box, { x: s.x, y: s.y, w: s.w, h: s.h }));
      if (blocked) continue;
      this.fragments.push({
        col: Math.floor(x / CELL_W),
        row: Math.floor((y + this.scrollY) / CELL_H),
        text,
        t0: t,
      });
      return;
    }
  }

  /** The shared particle pool: settle on one stage, fly to the next on scroll. */
  private particles(t: number, live: Stage[], bottomness: number) {
    const seeds = this.seeds;
    if (!seeds || !live.length) return;
    const vh = this.vh;
    const ref = vh * (0.5 + 0.4 * bottomness);

    let ia = 0;
    let ib = 0;
    let p = 0;
    const centerOf = (s: Stage) => s.y + s.h / 2;
    if (ref >= centerOf(live[live.length - 1])) {
      ia = ib = live.length - 1;
    } else if (ref > centerOf(live[0])) {
      for (let i = 0; i < live.length - 1; i++) {
        const c0 = centerOf(live[i]);
        const c1 = centerOf(live[i + 1]);
        if (ref >= c0 && ref < c1) {
          ia = i;
          ib = i + 1;
          p = (ref - c0) / (c1 - c0);
          break;
        }
      }
    }

    const A = live[ia];
    const B = live[ib];
    A.scene.prepare(A.ctx);
    if (B !== A) B.scene.prepare(B.ctx);
    const aOff = A.y > vh + 300 || A.y + A.h < -300;
    const intro = clamp01((t - 0.15) / 2.2);
    const m = this.mouse;
    const mouseOn = m.strength > 0.01;
    const radius = 110;
    const oa = this.a;
    const ob = this.b;

    for (let i = 0; i < this.n; i++) {
      const delay = 0.12 + this.stagger[i] * 0.42;
      const mix = B === A ? 0 : smoothstep(delay, delay + 0.34, p);
      let x: number;
      let y: number;
      let g: number;
      let c: number;
      let al: number;

      if (mix <= 0) {
        if (aOff && intro >= 1) continue;
        A.scene.sample(i, seeds, A.ctx, oa);
        x = A.x + oa.x;
        y = A.y + oa.y;
        g = oa.g;
        c = oa.c;
        al = oa.a;
      } else if (mix >= 1) {
        B.scene.sample(i, seeds, B.ctx, ob);
        x = B.x + ob.x;
        y = B.y + ob.y;
        g = ob.g;
        c = ob.c;
        al = ob.a;
      } else {
        A.scene.sample(i, seeds, A.ctx, oa);
        B.scene.sample(i, seeds, B.ctx, ob);
        const ax = A.x + oa.x;
        const ay = A.y + oa.y;
        const bx = B.x + ob.x;
        const by = B.y + ob.y;
        const e = easeInOutCubic(mix);
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const arc = Math.sin(Math.PI * e) * (this.swirl[i] - 0.5) * Math.min(len * 0.7, this.vw * 0.45);
        x = ax + dx * e + (-dy / len) * arc;
        y = ay + dy * e + (dx / len) * arc;
        if (mix < 0.08) {
          g = oa.g;
          c = oa.c;
          al = oa.a;
        } else if (mix > 0.92) {
          g = ob.g;
          c = ob.c;
          al = ob.a;
        } else {
          g = pick(CHARSET.noise, i, Math.floor(t * 16 + this.stagger[i] * 20));
          c = this.stagger[i] < 0.12 ? GOLD : this.swirl[i] < 0.5 ? LAV : MIST;
          al = 0.4 + 0.4 * Math.sin(Math.PI * e);
        }
      }

      if (intro < 1) {
        const start = this.stagger[i] * 0.5;
        const settle = smoothstep(start, start + 0.5, intro);
        if (settle < 1) {
          const cx = this.chaosX[i] * this.vw + Math.sin(t * 0.6 + i) * 14;
          const cy = this.chaosY[i] * vh + Math.cos(t * 0.5 + i * 1.3) * 10;
          const e = easeInOutCubic(settle);
          x = cx + (x - cx) * e;
          y = cy + (y - cy) * e;
          if (settle < 0.85) {
            g = pick(CHARSET.noise, i, Math.floor(t * 12 + this.chaosX[i] * 30));
            c = this.chaosY[i] < 0.55 ? MUTED : LAV;
            al = 0.3 + 0.3 * this.chaosX[i];
          }
        }
      }

      if (mouseOn) {
        const dx = x - m.x;
        const dy = y - m.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < radius * radius) {
          const d = Math.sqrt(d2) || 1;
          const f = 1 - d / radius;
          const push = f * f * m.strength;
          x += (dx / d) * push * 48;
          y += (dy / d) * push * 48;
          if (f > 0.35) g = pick(CHARSET.noise, i, Math.floor(t * 20));
          al = Math.min(1, al + push * 0.6);
        }
      }

      if (al > 0.02) this.putAt(x, y, g, c, al);
    }
  }

  /** Reduced motion: every visible stage shows its finished picture, no flight. */
  private staticParticles(live: Stage[]) {
    const seeds = this.seeds;
    if (!seeds) return;
    const o = this.a;
    for (const stage of live) {
      if (stage.y > this.vh || stage.y + stage.h < 0) continue;
      stage.ctx.q = stage === live[live.length - 1] ? 0.82 : 1;
      stage.scene.prepare(stage.ctx);
      for (let i = 0; i < this.n; i++) {
        stage.scene.sample(i, seeds, stage.ctx, o);
        if (o.a > 0.02) this.putAt(stage.x + o.x, stage.y + o.y, o.g, o.c, o.a);
      }
    }
  }

  private draw() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const cw = CELL_W * dpr;
    const ch = CELL_H * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const oy = this.offsetY * dpr;
    for (let k = 0; k < this.touchedCount; k++) {
      const idx = this.touched[k];
      const g = this.glyphs[idx];
      if (g === 0) continue;
      const col = idx % this.cols;
      const row = (idx / this.cols) | 0;
      ctx.globalAlpha = Math.min(1, this.alpha[idx]);
      ctx.drawImage(this.atlas, g * cw, this.colors[idx] * ch, cw, ch, col * cw, Math.round(oy + row * ch), cw, ch);
    }
    ctx.globalAlpha = 1;
  }
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
