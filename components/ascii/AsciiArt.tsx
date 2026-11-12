"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { registerArt } from "./decode-runtime";
import "./ascii.css";

/** A block of ASCII art that decodes in as it scrolls into view. */
export function AsciiArt({ lines, className }: { lines: readonly string[]; className?: string }) {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const pre = ref.current;
    if (!pre) return;
    return registerArt(pre, lines, pre.closest<HTMLElement>("article"));
  }, [lines]);

  return (
    <pre ref={ref} className={cn("ascii-art", className)} aria-hidden="true">
      {lines.join("\n")}
    </pre>
  );
}
