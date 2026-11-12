"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { approach } from "@/lib/version2-content";
import "./ClusterToClarity.css";

/**
 * "From cluster to clarity". The chips, core label and result card are HTML;
 * the glyph canvas (AsciiField, scene "cluster") draws the noisy clusters,
 * the streams into the core, and the single clean line out to the result.
 */
export function ClusterToClarity() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`clarity-panel relative overflow-hidden rounded-[2rem] border border-line p-5 sm:p-8 ${inView ? "is-visible" : ""}`}
      role="img"
      aria-label="Five disconnected sources converge through ArdbergAI into one connected intelligence."
    >
      <div className="relative flex items-center justify-between gap-4 font-mono text-[10px] font-bold uppercase tracking-[0.18em] sm:text-xs" aria-hidden="true">
        <span className="text-muted-foreground">01 / Scattered inputs</span>
        <span className="text-lavender">02 / Connected outcome</span>
      </div>

      <div className="clarity-stage" data-ascii-stage="cluster" aria-hidden="true">
        {approach.cluster.map((label, index) => (
          <div key={label} data-ascii-anchor={`chip${index}`} className={`clarity-chip clarity-chip-${index + 1}`}>
            <span className="clarity-chip-dot" />
            <span>{label}</span>
          </div>
        ))}

        <div className="clarity-core" data-ascii-anchor="core">
          <span className="clarity-core-label">ArdbergAI</span>
        </div>

        <div className="clarity-result" data-ascii-anchor="result">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-gold">Unified system</span>
            <ArrowUpRightIcon className="size-4 text-lavender" />
          </div>
          <div className="clarity-result-mark mt-5 flex items-end gap-1.5" aria-hidden="true">
            {[34, 55, 43, 75, 62, 100].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p className="mt-5 max-w-[15ch] font-heading text-2xl font-bold leading-tight tracking-tight text-mist sm:text-3xl">
            One connected intelligence.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">Clear signals. Useful decisions.</p>
        </div>
      </div>

      <div className="relative flex items-center gap-3 border-t border-line pt-4 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground" aria-hidden="true">
        <span className="size-1.5 rounded-full bg-gold" />
        Complexity, connected into capability
      </div>
    </div>
  );
}
