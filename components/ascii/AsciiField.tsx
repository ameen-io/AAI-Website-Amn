"use client";

import { useEffect, useRef } from "react";
import { approach } from "@/lib/version2-content";
import { AsciiEngine } from "./engine";
import "./ascii.css";

// The messy inputs from the approach section, typed into the hero background.
const words = approach.cluster.map((item) => item.toLowerCase().replace(/\s+/g, "_"));

/**
 * Fixed full-viewport glyph canvas. Sections opt in with `data-ascii-stage`
 * (and `data-ascii-anchor` children); see components/ascii/scenes.ts.
 */
export function AsciiField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let engine: AsciiEngine | null = null;
    try {
      engine = new AsciiEngine(canvas, words);
    } catch {
      return;
    }
    return () => engine?.destroy();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="ascii-field" />;
}
