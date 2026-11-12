/**
 * One shared animation loop for every decoding heading and ASCII artwork.
 * It only runs while something is mid-decode, and wakes on scroll/resize.
 */

type Item = { update(now: number, vh: number): boolean };

const items = new Set<Item>();
let raf = 0;
let listening = false;

export const SCRAMBLE = "#%&$?!*+=<>/\\|{}[]~^;01";
export const GHOST = ".:-=+";

const randomOf = (chars: string) => chars[(Math.random() * chars.length) | 0];

function tick(now: number) {
  raf = 0;
  const vh = window.innerHeight;
  let active = false;
  for (const item of items) if (item.update(now, vh)) active = true;
  if (active) raf = requestAnimationFrame(tick);
}

function wake() {
  if (!raf) raf = requestAnimationFrame(tick);
}

function addItem(item: Item) {
  if (!listening) {
    listening = true;
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("resize", wake);
  }
  items.add(item);
  wake();
  return () => {
    items.delete(item);
  };
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Heading decode. Each `.dc` char span keeps its real character (so layout,
 * selection, SEO and screen readers always see the true text); a CSS
 * pseudo-element draws the ghost/scramble glyph on top until it resolves.
 *
 * - `load`: time based, for the hero which is on screen at load.
 * - `scroll`: scrubbed by position. Fully resolved once the element's top
 *   reaches ~62% of the viewport height, so nothing is half-scrambled by the
 *   time it is in reading position. Scrolling back down re-scrambles it.
 */
export function registerDecode(el: HTMLElement, mode: "load" | "scroll", delayMs: number) {
  const chars = Array.from(el.querySelectorAll<HTMLElement>(".dc"));
  const n = chars.length;
  const threshold = new Float32Array(n);
  const state = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    threshold[i] = (i / Math.max(1, n - 1)) * 0.6 + Math.random() * 0.3;
    chars[i].dataset.g = randomOf(GHOST);
  }
  const reduced = prefersReducedMotion();
  const begin = performance.now() + delayMs;
  let lastScramble = 0;
  let lastP = Number.NaN;
  el.dataset.ready = "";

  return addItem({
    update(now, vh) {
      let p: number;
      if (reduced) p = 2;
      else if (mode === "load") p = (now - begin) / 1000;
      else p = (vh - el.getBoundingClientRect().top) / (vh * 0.38);

      if ((p >= 1.2 && lastP >= 1.2) || (p <= -0.2 && lastP <= -0.2)) return false;
      lastP = p;

      const refresh = now - lastScramble > 50;
      if (refresh) lastScramble = now;
      let active = mode === "load" && p < 1.2;
      for (let i = 0; i < n; i++) {
        const d = p - threshold[i];
        const s = d >= 0.06 ? 2 : d >= -0.12 ? 1 : 0;
        if (s !== state[i]) {
          state[i] = s;
          chars[i].dataset.s = String(s);
          if (s === 0) chars[i].dataset.g = randomOf(GHOST);
        }
        if (s === 1) {
          active = true;
          if (refresh) chars[i].dataset.g = randomOf(SCRAMBLE);
        }
      }
      return active;
    },
  });
}

/**
 * ASCII artwork reveal: cells resolve in a scattered top-down sweep as the
 * artwork scrolls in, and re-decode briefly when its card is hovered.
 */
export function registerArt(pre: HTMLElement, lines: readonly string[], hoverRoot: HTMLElement | null) {
  const rows = lines.length;
  const cols = lines[0]?.length ?? 0;
  const threshold = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) threshold[r * cols + c] = Math.random() * 0.72 + (r / rows) * 0.28;
  }
  const reduced = prefersReducedMotion();
  let hoverAt = -Infinity;
  let lastP = Number.NaN;
  let lastText = "";
  let lastFrame = 0;

  const onEnter = () => {
    if (reduced) return;
    hoverAt = performance.now();
    wake();
  };
  hoverRoot?.addEventListener("pointerenter", onEnter);

  const remove = addItem({
    update(now, vh) {
      let p = reduced ? 2 : (vh - pre.getBoundingClientRect().top) / (vh * 0.55);
      const hovering = now - hoverAt < 750;
      if (hovering) p = Math.min(p, ((now - hoverAt) / 750) * 1.15);
      if (!hovering && ((p >= 1.2 && lastP >= 1.2) || (p <= -0.2 && lastP <= -0.2))) return false;
      if (now - lastFrame < 45 && p === lastP) return true;
      lastFrame = now;
      lastP = p;

      let text = "";
      let active = hovering;
      for (let r = 0; r < rows; r++) {
        const line = lines[r];
        for (let c = 0; c < cols; c++) {
          const ch = line[c];
          if (ch === " ") {
            text += " ";
            continue;
          }
          const d = p - threshold[r * cols + c];
          if (d >= 0.05) text += ch;
          else if (d >= -0.1) {
            text += randomOf(SCRAMBLE);
            active = true;
          } else text += " ";
        }
        if (r < rows - 1) text += "\n";
      }
      if (text !== lastText) {
        lastText = text;
        pre.textContent = text;
      }
      return active;
    },
  });

  return () => {
    hoverRoot?.removeEventListener("pointerenter", onEnter);
    remove();
  };
}
