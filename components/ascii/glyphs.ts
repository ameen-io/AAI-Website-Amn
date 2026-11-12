/**
 * Glyph table shared by the canvas engine. Every character the field can draw
 * lives here once, so the engine can pre-render it into an atlas.
 */
export const GLYPHS = " .:-=+*#%@01/\\|<>[]{}~^_;!?$&ATCG'`,vabcdefghijklmnopqrstuwxyz";

export function glyph(char: string) {
  const index = GLYPHS.indexOf(char);
  return index < 0 ? 0 : index;
}

function set(chars: string) {
  return Uint8Array.from(Array.from(chars, glyph));
}

export const CHARSET = {
  noise: set("#%&$?!*+=<>/\\|{}[]~^;"),
  bits: set("0110+=-/"),
  ring: set("*+o=#"),
  dust: set(".:'`,"),
  dense: set("@%#*"),
  light: set(".:-+"),
};

/** Palette slots, resolved from CSS custom properties at runtime. */
export const COLOR = { lavender: 0, gold: 1, mist: 2, muted: 3 } as const;

/** Small integer hash (stateless noise for flicker and ambient cells). */
export function hash2(a: number, b: number) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function pick(charset: Uint8Array, a: number, b: number) {
  return charset[hash2(a, b) % charset.length];
}
