"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { registerDecode } from "./decode-runtime";
import "./ascii.css";

type DecodeTextProps = {
  text: string;
  /** `load` decodes on page load (hero); `scroll` is scrubbed by scroll position. */
  mode?: "load" | "scroll";
  delay?: number;
  className?: string;
};

/**
 * Renders real text, split into per-character spans, that resolves out of
 * ASCII glyphs. The true characters are always in the DOM; the glyphs are a
 * CSS overlay, so copy, search engines and assistive tech read normal text.
 */
export function DecodeText({ text, mode = "scroll", delay = 0, className }: DecodeTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return registerDecode(el, mode, delay);
  }, [mode, delay, text]);

  const parts = text.split(/(\s+)/);

  return (
    <span ref={ref} className={cn("decode", className)} data-decode={mode}>
      {parts.map((part, index) =>
        /^\s+$/.test(part) || part === "" ? (
          part
        ) : (
          <span key={index} className="decode-word">
            {Array.from(part).map((char, charIndex) => (
              <span key={charIndex} className="dc">
                {char}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}
