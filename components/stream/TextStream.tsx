"use client";

import { useEffect, useRef } from "react";
import { TextStream as Engine } from "./text-stream";
import "./stream.css";

/**
 * Overlay canvas: between sections, the page's text breaks into ASCII glyphs
 * and rejoins as the next section's text. At rest, all text is normal DOM text.
 */
export function TextStream() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let engine: Engine | null = null;
    try {
      engine = new Engine(canvas);
    } catch {
      return;
    }
    return () => engine?.destroy();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="text-stream-canvas" />;
}
