/**
 * Text stream: page text stays real, normal text. While you scroll from one
 * section to the next, the leaving section's characters break into ASCII
 * glyphs, fly across, and rejoin as the arriving section's characters, which
 * then turn back into normal text.
 *
 * Every visible character inside `main > section` is measured once (Range
 * rects, relative to its parent element, so sticky or animated elements are
 * followed live). Section k's characters are paired with section k+1's by
 * index; a pair's progress is driven by where the arriving character sits in
 * the viewport. While any character of an element is in flight, that
 * element's DOM text is hidden and the canvas draws it in its real font.
 */

type Unit = {
  el: HTMLElement;
  font: string;
  color: string;
  size: number;
  asc: number;
  x: number;
  y: number;
  hidden: boolean;
};

type Section = {
  n: number;
  unit: Uint16Array;
  dx: Float32Array;
  dy: Float32Array;
  char: string[];
  pIn: Float32Array;
  pOut: Float32Array;
  delay: Float32Array;
  /** Scatter origins for the first section's load-in (viewport fractions). */
  sx: Float32Array;
  sy: Float32Array;
};

const NOISE = "#%&$?!*+=<>/\\|{}[]~^;:01@";
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function hash(a: number, b: number) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function seeds(n: number) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = Math.random();
  return a;
}

export class TextStream {
  private readonly ctx: CanvasRenderingContext2D;
  private units: Unit[] = [];
  private sections: Section[] = [];
  private mono = "monospace";
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  private raf = 0;
  private start = 0;
  private timer = 0;
  private destroyed = false;
  private readonly cleanup: (() => void)[] = [];

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains-mono").trim();
    if (mono) this.mono = `${mono}, monospace`;

    const remeasure = () => {
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.measure(), 150);
    };
    const wake = () => this.request();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", wake, { passive: true });
    document.addEventListener("visibilitychange", wake);
    const observer = new ResizeObserver(remeasure);
    observer.observe(document.body);
    this.cleanup.push(() => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", wake);
      document.removeEventListener("visibilitychange", wake);
      observer.disconnect();
      window.clearTimeout(this.timer);
    });

    const begin = () => {
      if (this.destroyed) return;
      this.measure();
      this.start = performance.now();
      document.documentElement.classList.add("stream-ready");
      this.request();
    };
    if (document.fonts?.ready) document.fonts.ready.then(begin);
    else begin();
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.cleanup.forEach((fn) => fn());
    for (const u of this.units) u.el.removeAttribute("data-stream-hide");
    document.documentElement.classList.remove("stream-ready");
  }

  private readonly pairCache: Float32Array[] = [];

  /** Reusable per-boundary buffer of pair progress values. */
  private pairP(k: number, pairs: number) {
    let buf = this.pairCache[k];
    if (!buf || buf.length !== pairs) {
      buf = new Float32Array(pairs);
      this.pairCache[k] = buf;
    }
    return buf;
  }

  private request() {
    if (!this.raf && !this.destroyed && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  /* ------------------------------------------------------------------------ */

  private measure() {
    if (this.destroyed) return;
    this.vw = document.documentElement.clientWidth;
    this.vh = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.canvas.style.width = `${this.vw}px`;
    this.canvas.style.height = `${this.vh}px`;

    for (const u of this.units) u.el.removeAttribute("data-stream-hide");
    const units: Unit[] = [];
    const unitIndex = new Map<HTMLElement, number>();
    const range = document.createRange();
    const sections: Section[] = [];

    document.querySelectorAll<HTMLElement>("main > section").forEach((sectionEl) => {
      const unitOf: number[] = [];
      const dxs: number[] = [];
      const dys: number[] = [];
      const chars: string[] = [];
      const walker = document.createTreeWalker(sectionEl, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const p = node.parentElement;
          if (!p || p.closest("pre, svg, script, style, [data-stream-skip]")) return NodeFilter.FILTER_REJECT;
          return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const el = node.parentElement as HTMLElement;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        let ui = unitIndex.get(el);
        if (ui === undefined) {
          const cs = getComputedStyle(el);
          const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          this.ctx.font = font;
          ui = units.length;
          units.push({
            el,
            font,
            color: cs.color,
            size: parseFloat(cs.fontSize),
            asc: this.ctx.measureText("M").fontBoundingBoxAscent,
            x: 0,
            y: 0,
            hidden: false,
          });
          unitIndex.set(el, ui);
        }
        const transform = getComputedStyle(el).textTransform;
        const text = node.textContent ?? "";
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c.trim() === "") continue;
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect();
          if (r.width === 0) continue;
          unitOf.push(ui);
          dxs.push(r.left - box.left);
          dys.push(r.top - box.top);
          chars.push(transform === "uppercase" ? c.toUpperCase() : transform === "lowercase" ? c.toLowerCase() : c);
        }
      }
      const n = chars.length;
      if (!n) return;
      sections.push({
        n,
        unit: Uint16Array.from(unitOf),
        dx: Float32Array.from(dxs),
        dy: Float32Array.from(dys),
        char: chars,
        pIn: new Float32Array(n),
        pOut: new Float32Array(n),
        delay: seeds(n),
        sx: seeds(n),
        sy: seeds(n),
      });
    });

    this.units = units;
    this.sections = sections;
    this.request();
  }

  /* ------------------------------------------------------------------------ */

  private readonly frame = (now: number) => {
    this.raf = 0;
    const busy = this.render((now - this.start) / 1000);
    if (busy) this.request();
  };

  /** Returns true while anything is moving. */
  private render(t: number) {
    const { ctx, vh, units, sections } = this;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    const bottomness = clamp01(1 - (maxScroll - window.scrollY) / (vh * 0.4));

    for (const u of units) {
      const r = u.el.getBoundingClientRect();
      u.x = r.left;
      u.y = r.top;
      u.hidden = false;
    }

    // 1. Per character: how far it may arrive (from its height near the bottom)
    //    and how far it may leave (once it has risen into the upper screen).
    //    pIn temporarily holds arrival, pOut holds departure readiness.
    const intro = clamp01(t / 1.6);
    sections.forEach((s, k) => {
      for (let i = 0; i < s.n; i++) {
        const y = units[s.unit[i]].y + s.dy[i];
        const arrive =
          k === 0
            ? clamp01((intro - s.delay[i] * 0.45) / 0.55)
            : clamp01((Math.max(clamp01((vh - y) / (vh * 0.38)), bottomness) - s.delay[i] * 0.3) / 0.7);
        s.pIn[i] = arrive;
        // A source only actually breaks apart near the top edge; lower down it
        // stays readable while its glyph copies stream to the next section.
        s.pOut[i] = clamp01((vh * 0.15 - y) / (vh * 0.08));
      }
    });

    // 2. Pair sections k -> k+1 proportionally in reading order. A pair moves
    //    only as far as both ends allow; a character is at rest once all its
    //    pairs are done (arriving) or none have started (leaving).
    for (let k = 0; k < sections.length - 1; k++) {
      const a = sections[k];
      const b = sections[k + 1];
      const pairs = Math.max(a.n, b.n);
      const arrive = b.pIn.slice();
      const depart = a.pOut.slice();
      b.pIn.fill(1);
      a.pOut.fill(0);
      const pp = this.pairP(k, pairs);
      for (let j = 0; j < pairs; j++) {
        const si = Math.floor((j * a.n) / pairs);
        const ti = Math.floor((j * b.n) / pairs);
        const p = arrive[ti];
        pp[j] = p;
        if (p < b.pIn[ti]) b.pIn[ti] = p;
        const gone = p * depart[si];
        if (gone > a.pOut[si]) a.pOut[si] = gone;
      }
    }
    // Nothing leaves the last section.
    sections[sections.length - 1]?.pOut.fill(0);

    // 3. Any element with a character not at rest hands its text to the canvas.
    let busy = t < 2.2;
    sections.forEach((s) => {
      for (let i = 0; i < s.n; i++) {
        if (s.pOut[i] > 0 || s.pIn[i] < 1) units[s.unit[i]].hidden = true;
      }
    });
    for (const u of units) {
      const was = u.el.hasAttribute("data-stream-hide");
      if (u.hidden !== was) u.el.toggleAttribute("data-stream-hide", u.hidden);
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vw, vh);
    ctx.textBaseline = "alphabetic";
    let font = "";
    const setFont = (f: string) => {
      if (f !== font) {
        ctx.font = f;
        font = f;
      }
    };

    // 4. Characters at rest inside hidden elements: drawn exactly as the page would.
    sections.forEach((s) => {
      for (let i = 0; i < s.n; i++) {
        if (s.pOut[i] > 0 || s.pIn[i] < 1) continue;
        const u = units[s.unit[i]];
        if (!u.hidden) continue;
        const x = u.x + s.dx[i];
        const y = u.y + s.dy[i];
        if (y < -80 || y > vh + 20) continue;
        setFont(u.font);
        ctx.fillStyle = u.color;
        ctx.fillText(s.char[i], x, y + u.asc);
      }
    });

    // 5. Characters in flight: break into glyphs, travel, rejoin.
    const fly = (
      from: { x: number; y: number; u: Unit; c: string },
      to: { x: number; y: number; u: Unit; c: string },
      p: number,
      seed: number,
    ) => {
      const e = ease(p);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const arc = Math.sin(Math.PI * e) * ((hash(seed, 7) & 1023) / 1023 - 0.5) * Math.min(len * 0.45, this.vw * 0.35);
      const x = from.x + dx * e + (-dy / len) * arc;
      const y = from.y + dy * e + (dx / len) * arc;
      if (y < -60 || y > vh + 60) return;
      const size = from.u.size + (to.u.size - from.u.size) * e;
      if (p < 0.08) {
        setFont(from.u.font);
        ctx.fillStyle = from.u.color;
        ctx.fillText(from.c, x, y + from.u.asc);
      } else if (p > 0.92) {
        setFont(to.u.font);
        ctx.fillStyle = to.u.color;
        ctx.fillText(to.c, x, y + to.u.asc);
      } else {
        const glyph = NOISE[hash(seed, Math.floor(performance.now() / 70)) % NOISE.length];
        setFont(`500 ${size.toFixed(1)}px ${this.mono}`);
        ctx.fillStyle = e < 0.5 ? from.u.color : to.u.color;
        ctx.fillText(glyph, x, y + size * 0.8);
      }
    };

    // Load-in: the first section gathers out of a scattered glyph cloud.
    const first = sections[0];
    if (first) {
      for (let i = 0; i < first.n; i++) {
        const p = first.pIn[i];
        if (p >= 1) continue;
        busy = true;
        const u = units[first.unit[i]];
        const to = { x: u.x + first.dx[i], y: u.y + first.dy[i], u, c: first.char[i] };
        const from = { x: first.sx[i] * this.vw, y: first.sy[i] * vh, u, c: first.char[i] };
        if (p <= 0) {
          setFont(`500 ${u.size}px ${this.mono}`);
          ctx.fillStyle = u.color;
          ctx.globalAlpha = 0.35;
          ctx.fillText(NOISE[hash(i, Math.floor(t * 12)) % NOISE.length], from.x, from.y);
          ctx.globalAlpha = 1;
        } else fly({ ...from, c: NOISE[i % NOISE.length] }, to, Math.max(p, 0.09), i);
      }
    }

    for (let k = 0; k < sections.length - 1; k++) {
      const a = sections[k];
      const b = sections[k + 1];
      const pairs = Math.max(a.n, b.n);
      const pp = this.pairP(k, pairs);
      for (let j = 0; j < pairs; j++) {
        const p = pp[j];
        if (p <= 0 || p >= 1) continue;
        busy = true;
        const si = Math.floor((j * a.n) / pairs);
        const ti = Math.floor((j * b.n) / pairs);
        const ua = units[a.unit[si]];
        const ub = units[b.unit[ti]];
        fly(
          { x: ua.x + a.dx[si], y: ua.y + a.dy[si], u: ua, c: a.char[si] },
          { x: ub.x + b.dx[ti], y: ub.y + b.dy[ti], u: ub, c: b.char[ti] },
          p,
          k * 100003 + j,
        );
      }
    }
    return busy;
  }
}
