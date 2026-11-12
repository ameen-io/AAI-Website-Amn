import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";
import { AsciiArt } from "@/components/ascii/AsciiArt";
import { industryGlyphs } from "@/components/ascii/industry-glyphs";
import { industries, industryAnchor } from "@/lib/version2-content";
import { cn } from "@/lib/utils";

const accents = ["text-lavender", "text-gold", "text-mist"] as const;

/** Each industry's icon, redrawn as ASCII art that decodes in as the card arrives (and again on hover). */
function IndustryArtwork({ index, signal }: { index: number; signal: string }) {
  return (
    <div
      className="relative h-44 shrink-0 overflow-hidden border-b border-line bg-graphite [container-type:size] md:h-full md:w-[60%] md:border-b-0 md:border-l"
      aria-hidden="true"
    >
      <span className="absolute left-5 top-5 z-[1] font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Industry / {String(index + 1).padStart(2, "0")}
      </span>
      <div className="absolute inset-0 flex items-center justify-center md:justify-end md:pr-[9%]">
        <AsciiArt
          lines={industryGlyphs[index] ?? industryGlyphs[0]}
          className={cn("text-[min(3.4cqh,2.3cqw,11px)]", accents[index % accents.length])}
        />
      </div>
      <span className="absolute bottom-5 left-5 z-[1] border border-line bg-panel px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {signal}
      </span>
    </div>
  );
}

export function IndustryExplorer() {
  const count = String(industries.items.length).padStart(2, "0");

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between border-b border-line pb-4 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <span>Explore {count} industries</span>
        <span>Scroll to explore ↓</span>
      </div>
      <div className="relative pt-4">
      {industries.items.map(({ title, body, signals }, index) => (
        <article
          id={industryAnchor(title)}
          key={title}
          className="industry-stack-card group mb-4 min-w-0 scroll-mt-24 overflow-hidden border border-line bg-panel transition-colors target:border-lavender md:h-[320px] lg:mb-0 lg:h-[clamp(240px,35vh,320px)] lg:motion-safe:sticky"
          style={{ top: `calc(4.5rem + ${index * 2}rem)`, zIndex: index + 1, boxShadow: "0 -16px 30px -20px var(--shadow-color)" }}
        >
          <div className="flex h-8 items-center justify-between gap-3 border-b border-line bg-elevated px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 font-mono text-[10px] font-bold text-gold">{String(index + 1).padStart(2, "0")} / {count}</span>
              <h3 className="truncate font-heading text-sm font-semibold text-mist sm:text-base">{title}</h3>
            </div>
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:block">Industry systems</span>
          </div>
          <div className="flex flex-col md:h-[calc(100%-2rem)] md:flex-row-reverse">
            <IndustryArtwork index={index} signal={signals[0]} />
            <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6 md:w-[40%] lg:p-4 xl:p-6">
              <p className="text-sm leading-relaxed text-muted-foreground lg:text-base">{body}</p>
              <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-mist/65">
                {signals.map((signal) => <span key={signal}>{signal}</span>)}
              </div>
              <Link
                href="#contact"
                className="mt-7 inline-flex w-fit items-center gap-2 border-b border-lavender pb-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-lavender transition-colors hover:text-mist focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lavender md:mt-auto"
              >
                Discuss this industry <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      ))}
      </div>
    </div>
  );
}
