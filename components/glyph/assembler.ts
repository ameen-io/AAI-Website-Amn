/**
 * The glyph assembler. Every visible character on the page is a particle on
 * one overlay canvas. Each `[data-asm]` element (and `[data-frame]` border)
 * starts as a cloud of scattered noise glyphs and flies together into its
 * exact characters as it scrolls into view; the real DOM text stays the source
 * of truth and becomes visible once assembled (headline mosaics stay drawn).
 *
 *   data-asm="text"    every character of the element's own text
 *   data-asm="art"     a <pre> block of ASCII art (grid-measured)
 *   data-asm="mosaic"  a heading redrawn as letterforms made of small glyphs
 *   data-frame         an ASCII border (+--+ |) drawn around the element box;
 *                      [data-frame-label] children cut a gap in its top edge
 */

type Kind = "text" | "art" | "mosaic" | "frame";

type Style = { key: string; font: string; stretch: CanvasFontStretch; color: string };

type Batch = {
  el: HTMLElement;
  kind: Kind;
  n: number;
  x: Float32Array;
  y: Float32Array;
  size: Float32Array;
  glyph: Uint16Array;
  style: Uint16Array;
  alpha: Float32Array;
  dense: Uint8Array;
  ox: Float32Array;
  oy: Float32Array;
  delay: Float32Array;
  top: number;
  bottom: number;
  built: boolean;
  intro: number;
  /** On screen at first load: assembles on the intro timeline, not on scroll. */
  introOnly: boolean;
};

const NOISE = "#%&$?!*+=<>/\\|{}[]~^;:01";
const RAMP = ".:-=+*#";
const DENSE = "@#%&8$";
const BASE = 28;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hash(a: number, b: number) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function stretchKeyword(value: string): CanvasFontStretch {
  const pct = parseFloat(value);
  if (!Number.isFinite(pct)) return "normal";
  if (pct <= 80) return "condensed";
  if (pct <= 93) return "semi-condensed";
  if (pct <= 106) return "normal";
  return "semi-expanded";
}

export class GlyphAssembler {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly atlas = document.createElement("canvas");
  private readonly scratch = document.createElement("canvas");
  private dpr = 1;
  private vw = 0;
  private vh = 0;

  private glyphIndex = new Map<string, number>();
  private glyphs: string[] = [];
  private styles: Style[] = [];
  private styleIndex = new Map<string, number>();
  private metrics: { asc: number; desc: number; adv: number }[] = [];
  private cellW = 0;
  private cellH = 0;
  private pad = 0;

  private batches: Batch[] = [];
  private noiseCodes: number[] = [];
  private readonly start = performance.now();
  private raf = 0;
  private lastActivity = 0;
  private measureTimer = 0;
  private reduced: boolean;
  private destroyed = false;
  private ready = false;
  private measured = false;
  private readonly mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: false, s: 0 };
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = motion.matches;

    const queueMeasure = () => {
      window.clearTimeout(this.measureTimer);
      this.measureTimer = window.setTimeout(() => this.measure(), 160);
    };
    const onScroll = () => {
      this.lastActivity = performance.now();
      this.request();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (!this.mouse.on) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
      }
      this.mouse.tx = e.clientX;
      this.mouse.ty = e.clientY;
      this.mouse.on = true;
      this.lastActivity = performance.now();
      this.request();
    };
    const onLeave = () => {
      this.mouse.on = false;
    };
    const onVisibility = () => {
      if (!document.hidden) this.request();
    };
    const onMotion = () => {
      this.reduced = motion.matches;
      this.request();
    };

    window.addEventListener("resize", queueMeasure);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotion);
    const observer = new ResizeObserver(queueMeasure);
    observer.observe(document.body);
    this.cleanup.push(() => {
      window.removeEventListener("resize", queueMeasure);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotion);
      observer.disconnect();
      window.clearTimeout(this.measureTimer);
    });

    const begin = () => {
      if (this.destroyed) return;
      this.measure();
      document.documentElement.classList.add("glyph-ready");
      this.ready = true;
      this.request();
    };
    if (document.fonts?.ready) document.fonts.ready.then(begin);
    else begin();
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    document.documentElement.classList.remove("glyph-ready");
    for (const b of this.batches) b.el.classList.remove("is-built");
  }

  private request() {
    if (!this.raf && !this.destroyed && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  /* ------------------------------------------------------------------------ */
  /* Measuring                                                                */
  /* ------------------------------------------------------------------------ */

  private code(char: string) {
    let i = this.glyphIndex.get(char);
    if (i === undefined) {
      i = this.glyphs.length;
      this.glyphs.push(char);
      this.glyphIndex.set(char, i);
    }
    return i;
  }

  private styleOf(cs: CSSStyleDeclaration, overrides?: Partial<{ weight: string; stretch: string; color: string }>) {
    const weight = overrides?.weight ?? cs.fontWeight;
    const stretch = stretchKeyword(overrides?.stretch ?? cs.fontStretch);
    const color = overrides?.color ?? cs.color;
    const font = `${cs.fontStyle === "italic" ? "italic " : ""}${weight} ${BASE * this.dpr}px ${cs.fontFamily}`;
    const key = `${font}|${stretch}|${color}`;
    let i = this.styleIndex.get(key);
    if (i === undefined) {
      i = this.styles.length;
      this.styles.push({ key, font, stretch, color });
      this.styleIndex.set(key, i);
    }
    return i;
  }

  private measure() {
    if (this.destroyed) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = vw;
    this.vh = vh;
    this.dpr = dpr;
    this.canvas.width = Math.round(vw * dpr);
    this.canvas.height = Math.round(vh * dpr);
    this.canvas.style.width = `${vw}px`;
    this.canvas.style.height = `${vh}px`;

    this.glyphIndex = new Map();
    this.glyphs = [];
    this.styles = [];
    this.styleIndex = new Map();
    this.noiseCodes = Array.from(NOISE, (c) => this.code(c));
    for (const c of RAMP + DENSE) this.code(c);

    const previous = new Map(this.batches.map((b) => [b.el, b]));
    const batches: Batch[] = [];
    const scrollY = window.scrollY;
    const els = document.querySelectorAll<HTMLElement>("[data-asm], [data-frame]");

    for (const el of els) {
      if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
      const kinds: Kind[] = [];
      if (el.dataset.frame !== undefined) kinds.push("frame");
      let asm = el.dataset.asm as Kind | undefined;
      if (asm === "mosaic") {
        // A mosaic needs scale to stay legible; small headings assemble as plain characters.
        const small = parseFloat(getComputedStyle(el).fontSize) < 72;
        el.toggleAttribute("data-mosaic-off", small);
        if (small) asm = "text";
      }
      if (asm === "text" || asm === "art" || asm === "mosaic") kinds.push(asm);
      for (const kind of kinds) {
        const batch =
          kind === "frame" ? this.measureFrame(el, scrollY)
          : kind === "art" ? this.measureArt(el, scrollY)
          : kind === "mosaic" ? this.measureMosaic(el, scrollY)
          : this.measureText(el, scrollY);
        if (!batch) continue;
        const old = previous.get(el);
        if (old?.kind === kind) {
          batch.built = old.built;
          batch.introOnly = old.introOnly;
        }
        batches.push(batch);
      }
    }
    this.batches = batches;
    this.measured = true;
    this.buildAtlas();
    this.lastActivity = performance.now();
    this.request();
  }

  private makeBatch(el: HTMLElement, kind: Kind, n: number, top: number, bottom: number): Batch {
    const b: Batch = {
      el,
      kind,
      n,
      x: new Float32Array(n),
      y: new Float32Array(n),
      size: new Float32Array(n),
      glyph: new Uint16Array(n),
      style: new Uint16Array(n),
      alpha: new Float32Array(n).fill(1),
      dense: new Uint8Array(n),
      ox: new Float32Array(n),
      oy: new Float32Array(n),
      delay: new Float32Array(n),
      top,
      bottom,
      built: false,
      intro: 0,
      introOnly: !this.measured && top - window.scrollY < this.vh * 0.98,
    };
    const spread = this.vw * 0.34;
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 24 + Math.pow(Math.random(), 1.3) * spread;
      b.ox[i] = Math.cos(angle) * dist;
      b.oy[i] = Math.sin(angle) * dist * 0.5 + Math.random() * this.vh * 0.12;
      b.delay[i] = Math.random() * 0.55;
    }
    // On first load, sections lower in the first viewport assemble a little later.
    b.intro = 0.15 + clamp01((top - window.scrollY) / this.vh) * 0.7;
    return b;
  }

  /** Every non-space character of an element's own text (nested [data-asm] excluded). */
  private collectChars(el: HTMLElement) {
    const out: { char: string; rect: DOMRect; parent: HTMLElement }[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentElement;
        while (p && p !== el) {
          if (p.dataset.asm !== undefined) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const range = document.createRange();
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent ?? "";
      const parent = node.parentElement as HTMLElement;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char.trim() === "") continue;
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        out.push({ char, rect, parent });
      }
    }
    return out;
  }

  private measureText(el: HTMLElement, scrollY: number) {
    const chars = this.collectChars(el);
    if (!chars.length) return null;
    const box = el.getBoundingClientRect();
    const b = this.makeBatch(el, "text", chars.length, box.top + scrollY, box.bottom + scrollY);
    const styleCache = new Map<HTMLElement, { style: number; size: number }>();
    chars.forEach(({ char, rect, parent }, i) => {
      let s = styleCache.get(parent);
      if (!s) {
        const cs = getComputedStyle(parent);
        s = { style: this.styleOf(cs), size: parseFloat(cs.fontSize) };
        styleCache.set(parent, s);
      }
      b.x[i] = rect.left;
      b.y[i] = rect.top + scrollY;
      b.size[i] = s.size;
      b.style[i] = s.style;
      b.glyph[i] = this.code(char);
      // Reading order with a little randomness, so lines resolve roughly left to right.
      b.delay[i] = (i / chars.length) * 0.35 + Math.random() * 0.25;
    });
    return b;
  }

  private measureArt(el: HTMLElement, scrollY: number) {
    const text = el.textContent ?? "";
    const lines = text.split("\n");
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const lineHeight = parseFloat(cs.lineHeight) || size * 1.2;
    const style = this.styleOf(cs);

    // Advance from the longest line; offset from the first visible character.
    const range = document.createRange();
    let longest = 0;
    let longestStart = 0;
    let offset = 0;
    let firstRow = -1;
    let firstCol = 0;
    let firstOffset = 0;
    lines.forEach((line, row) => {
      if (line.length > lines[longest].length) {
        longest = row;
        longestStart = offset;
      }
      if (firstRow < 0) {
        const col = line.search(/\S/);
        if (col >= 0) {
          firstRow = row;
          firstCol = col;
          firstOffset = offset + col;
        }
      }
      offset += line.length + 1;
    });
    if (firstRow < 0 || !lines[longest].length) return null;
    range.setStart(node, longestStart);
    range.setEnd(node, longestStart + lines[longest].length);
    const adv = range.getBoundingClientRect().width / lines[longest].length;
    range.setStart(node, firstOffset);
    range.setEnd(node, firstOffset + 1);
    const first = range.getBoundingClientRect();
    const originX = first.left - firstCol * adv;
    const originY = first.top - firstRow * lineHeight;

    let count = 0;
    for (const line of lines) for (const c of line) if (c !== " ") count++;
    const box = el.getBoundingClientRect();
    const b = this.makeBatch(el, "art", count, box.top + scrollY, box.bottom + scrollY);
    let i = 0;
    lines.forEach((line, row) => {
      for (let col = 0; col < line.length; col++) {
        const c = line[col];
        if (c === " ") continue;
        b.x[i] = originX + col * adv;
        b.y[i] = originY + row * lineHeight + scrollY;
        b.size[i] = size;
        b.style[i] = style;
        b.glyph[i] = this.code(c);
        b.delay[i] = (row / lines.length) * 0.3 + Math.random() * 0.3;
        i++;
      }
    });
    return b;
  }

  private measureMosaic(el: HTMLElement, scrollY: number) {
    const chars = this.collectChars(el);
    if (!chars.length) return null;
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const w = Math.ceil(box.width);
    const h = Math.ceil(box.height);
    if (w < 4 || h < 4) return null;

    // 1. Rasterise the heading exactly as laid out.
    const sc = this.scratch;
    sc.width = w;
    sc.height = h;
    const sctx = sc.getContext("2d", { willReadFrequently: true });
    if (!sctx) return null;
    sctx.clearRect(0, 0, w, h);
    sctx.fillStyle = "#000";
    sctx.textBaseline = "alphabetic";
    const fontCache = new Map<HTMLElement, { font: string; stretch: CanvasFontStretch; asc: number }>();
    for (const { char, rect, parent } of chars) {
      let f = fontCache.get(parent);
      if (!f) {
        const pcs = getComputedStyle(parent);
        const font = `${pcs.fontStyle === "italic" ? "italic " : ""}${pcs.fontWeight} ${pcs.fontSize} ${pcs.fontFamily}`;
        const stretch = stretchKeyword(pcs.fontStretch);
        sctx.font = font;
        sctx.fontStretch = stretch;
        f = { font, stretch, asc: sctx.measureText("M").fontBoundingBoxAscent };
        fontCache.set(parent, f);
      }
      sctx.font = f.font;
      sctx.fontStretch = f.stretch;
      sctx.fillText(char, rect.left - box.left, rect.top - box.top + f.asc);
    }
    const data = sctx.getImageData(0, 0, w, h).data;

    // 2. Sample into a grid of small glyph cells.
    // ~9 glyph rows per cap height keeps the letterforms legible.
    const g = Math.max(4.5, Math.min(11, size / 13));
    const mctx = this.ctx;
    mctx.font = `500 ${g}px ${cs.fontFamily}`;
    mctx.fontStretch = "normal";
    const cw = mctx.measureText("M").width || g * 0.6;
    const ch = g * 1.18;
    const cols = Math.floor(w / cw);
    const rows = Math.floor(h / ch);
    const cells: { col: number; row: number; cov: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x0 = Math.floor(c * cw);
        const y0 = Math.floor(r * ch);
        const x1 = Math.min(w, Math.floor((c + 1) * cw));
        const y1 = Math.min(h, Math.floor((r + 1) * ch));
        let sum = 0;
        let n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            sum += data[(y * w + x) * 4 + 3];
            n++;
          }
        }
        const cov = n ? sum / n / 255 : 0;
        if (cov > 0.16) cells.push({ col: c, row: r, cov });
      }
    }
    if (!cells.length) return null;

    const style = this.styleOf(cs, { weight: "500", stretch: "100%" });
    const b = this.makeBatch(el, "mosaic", cells.length, box.top + scrollY, box.bottom + scrollY);
    const contentTop = (ch - g * 1.0) / 2;
    cells.forEach(({ col, row, cov }, i) => {
      // Solid strokes read as one calm texture (mostly #); edges step down a ramp.
      const dense = cov >= 0.72;
      const char = dense
        ? hash(col, row) % 7 === 0 ? "@" : "#"
        : RAMP[Math.min(RAMP.length - 2, Math.floor((cov / 0.72) * (RAMP.length - 1)))];
      b.x[i] = box.left + col * cw;
      b.y[i] = box.top + scrollY + row * ch + contentTop - g * 0.08;
      b.size[i] = g;
      b.style[i] = style;
      b.glyph[i] = this.code(char);
      b.dense[i] = dense ? 1 : 0;
      b.alpha[i] = dense ? 1 : 0.4 + 0.6 * Math.min(1, cov / 0.72);
      b.delay[i] = (col / cols) * 0.3 + Math.random() * 0.3;
    });
    return b;
  }

  private measureFrame(el: HTMLElement, scrollY: number) {
    const box = el.getBoundingClientRect();
    const rule = el.dataset.frame === "rule";
    if (box.width < 20 || (!rule && box.height < 20)) return null;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.getPropertyValue("--frame-size")) || 13;
    const color = cs.getPropertyValue("--frame-color").trim() || cs.color;
    const style = this.styleOf(cs, { weight: "400", stretch: "100%", color });
    const ctx = this.ctx;
    ctx.font = `400 ${size}px ${cs.fontFamily}`;
    ctx.fontStretch = "normal";
    const metric = ctx.measureText("M");
    const adv = metric.width || size * 0.6;
    const asc = metric.fontBoundingBoxAscent || size * 0.95;
    const lh = size * 1.5;
    const cols = Math.max(2, Math.round(box.width / adv));
    const rows = Math.max(2, Math.round(box.height / lh));
    const sx = box.width / cols;
    const sy = box.height / rows;
    const gaps = Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-frame-label], :scope > * > [data-frame-label]"))
      .map((label) => label.getBoundingClientRect())
      .filter((r) => r.width > 0);

    const points: { x: number; y: number; c: string }[] = [];
    const add = (col: number, row: number, c: string) => {
      const x = box.left + col * sx;
      const y = box.top + row * sy;
      if (row === 0 && gaps.some((r) => x > r.left - adv && x < r.right + adv * 0.3)) return;
      points.push({ x, y, c });
    };
    if (rule) {
      // A single ruled line through the middle of the element, label cut in.
      const mid = box.height / 2;
      for (let c = 0; c <= cols; c++) {
        const x = box.left + c * sx;
        if (gaps.some((r) => x > r.left - adv && x < r.right + adv * 0.3)) continue;
        points.push({ x, y: box.top + mid, c: "-" });
      }
    } else {
      for (let c = 0; c <= cols; c++) {
        const corner = c === 0 || c === cols;
        add(c, 0, corner ? "+" : "-");
        add(c, rows, corner ? "+" : "-");
      }
      for (let r = 1; r < rows; r++) {
        add(0, r, "|");
        add(cols, r, "|");
      }
    }

    const b = this.makeBatch(el, "frame", points.length, box.top + scrollY, box.bottom + scrollY);
    points.forEach(({ x, y, c }, i) => {
      // Centre each border glyph on the box edge (baseline ~1/3 em below the line).
      b.x[i] = x - adv / 2;
      b.y[i] = y + scrollY + size * 0.33 - asc;
      b.size[i] = size;
      b.style[i] = style;
      b.glyph[i] = this.code(c);
      b.alpha[i] = 0.7;
      b.delay[i] = Math.random() * 0.5;
    });
    return b;
  }

  private buildAtlas() {
    const dpr = this.dpr;
    const base = BASE * dpr;
    const ctx = this.atlas.getContext("2d");
    if (!ctx) return;
    this.metrics = this.styles.map((s) => {
      ctx.font = s.font;
      ctx.fontStretch = s.stretch;
      const m = ctx.measureText("M");
      return { asc: m.fontBoundingBoxAscent, desc: m.fontBoundingBoxDescent, adv: m.width };
    });
    const maxAdv = Math.max(base * 0.7, ...this.metrics.map((m) => m.adv));
    const maxH = Math.max(base * 1.3, ...this.metrics.map((m) => m.asc + m.desc));
    this.pad = Math.ceil(base * 0.12);
    this.cellW = Math.ceil(maxAdv + this.pad * 2);
    this.cellH = Math.ceil(maxH + this.pad * 2);
    this.atlas.width = Math.max(1, this.glyphs.length * this.cellW);
    this.atlas.height = Math.max(1, this.styles.length * this.cellH);
    ctx.clearRect(0, 0, this.atlas.width, this.atlas.height);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    this.styles.forEach((s, si) => {
      ctx.font = s.font;
      ctx.fontStretch = s.stretch;
      ctx.fillStyle = s.color;
      const asc = this.metrics[si].asc;
      this.glyphs.forEach((g, gi) => {
        ctx.fillText(g, gi * this.cellW + this.pad, si * this.cellH + this.pad + asc);
      });
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Frame loop                                                               */
  /* ------------------------------------------------------------------------ */

  private readonly frame = (now: number) => {
    this.raf = 0;
    if (!this.ready) return;
    const t = (now - this.start) / 1000;
    const busy = this.render(t, window.scrollY);
    if (this.reduced) return;
    // Keep full rate while anything moves; otherwise idle at a slow shimmer rate.
    if (busy || now - this.lastActivity < 900) this.request();
    else {
      window.setTimeout(() => this.request(), 110);
    }
  };

  /** Returns true while anything on or near the screen is still assembling. */
  private render(t: number, scrollY: number) {
    const { ctx, dpr, vh, vw } = this;
    const reduced = this.reduced;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const bottomness = clamp01(1 - (maxScroll - scrollY) / (vh * 0.5));

    const m = this.mouse;
    m.x += (m.tx - m.x) * 0.25;
    m.y += (m.ty - m.y) * 0.25;
    m.s += ((m.on && !reduced ? 1 : 0) - m.s) * 0.1;
    const radius = 95;
    const radius2 = radius * radius;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k0 = 1 / BASE;
    const cellW = this.cellW;
    const cellH = this.cellH;
    const pad = this.pad;
    const noise = this.noiseCodes;
    let busy = false;

    for (const b of this.batches) {
      const vtop = b.top - scrollY;
      const vbottom = b.bottom - scrollY;
      // Scroll-scrubbed: starts as the top enters, resolves by ~72% of the viewport.
      let p = reduced || b.introOnly ? 1 : clamp01((vh * 1.02 - vtop) / (vh * 0.3));
      p = Math.max(p, bottomness);
      if (!reduced) p = Math.min(p, clamp01((t - b.intro) / 1.3));

      const built = p >= 1;
      if (built !== b.built) {
        b.built = built;
        if (b.kind === "text" || b.kind === "art") b.el.classList.toggle("is-built", built);
      }
      if (built && (b.kind === "text" || b.kind === "art")) continue;
      if (vbottom < -vh * 0.7 || vtop > vh * 1.7) continue;
      if (built && (vbottom < -40 || vtop > vh + 40)) continue;
      if (!built) busy = true;

      const settled = b.kind === "mosaic" && built;
      // A waiting cloud fades in only as its element approaches the viewport.
      const cloud = built ? 1 : clamp01((vh * 1.2 - vtop) / (vh * 0.35));
      if (cloud <= 0) continue;
      for (let i = 0; i < b.n; i++) {
        const q = built ? 1 : clamp01((p - b.delay[i]) / 0.42);
        const inv = 1 - q;
        const e = 1 - inv * inv * inv;
        let x = b.x[i];
        let y = b.y[i] - scrollY;
        let g = b.glyph[i];
        let a = b.alpha[i];
        if (q < 1) {
          const drift = (1 - e) * 7;
          x += b.ox[i] * (1 - e) + Math.sin(t * 0.8 + i) * drift;
          y += b.oy[i] * (1 - e) + Math.cos(t * 0.7 + i * 1.7) * drift;
          if (q < 0.78) g = noise[hash(i, Math.floor(t * 12 + b.delay[i] * 40)) % noise.length];
          a *= (0.09 + 0.91 * e * e) * cloud;
        } else if (settled && !reduced && b.dense[i] && hash(i, Math.floor(t * 1.4 + i * 0.37)) % 29 === 0) {
          g = noise[hash(i, Math.floor(t * 3)) % noise.length];
        }

        if (b.kind === "mosaic" && m.s > 0.01) {
          const dx = x - m.x;
          const dy = y - m.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius2) {
            const d = Math.sqrt(d2) || 1;
            const f = 1 - d / radius;
            const push = f * f * m.s * 26;
            x += (dx / d) * push;
            y += (dy / d) * push;
            if (f > 0.55) g = noise[hash(i, Math.floor(t * 18)) % noise.length];
          }
        }

        const size = b.size[i];
        if (x < -40 || x > vw + 40 || y < -60 || y > vh + 60 || a < 0.02) continue;
        const k = size * k0;
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.drawImage(
          this.atlas,
          g * cellW,
          b.style[i] * cellH,
          cellW,
          cellH,
          x * dpr - pad * k,
          y * dpr - pad * k,
          cellW * k,
          cellH * k,
        );
      }
    }
    ctx.globalAlpha = 1;
    return busy && !reduced;
  }
}
