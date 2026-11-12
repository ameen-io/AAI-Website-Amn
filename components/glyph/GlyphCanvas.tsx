"use client";

import { useEffect, useRef } from "react";
import { GlyphAssembler } from "./assembler";

/** Overlay canvas that assembles every [data-asm] element from scattered glyphs. */
export function GlyphCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let assembler: GlyphAssembler | null = null;
    try {
      assembler = new GlyphAssembler(canvas);
    } catch {
      return;
    }
    return () => assembler?.destroy();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="glyph-canvas" />;
}
