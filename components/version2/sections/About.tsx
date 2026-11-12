import { ArrowDownIcon, ArrowUpRightIcon } from "lucide-react";
import { DecodeText } from "@/components/ascii/DecodeText";
import { Container } from "@/components/version2/site/Container";
import { about, contact } from "@/lib/version2-content";
import "./About.css";

const inputs = ["Data", "Models", "Systems"];

/**
 * Hero picture. The labels are real HTML; the glyph canvas (AsciiField) draws
 * the three input streams converging into one ring around "Connected intelligence".
 */
function HeroStage() {
  return (
    <div data-ascii-stage="converge" className="relative h-[340px] sm:h-[440px] xl:h-[480px]" aria-hidden="true">
      <p className="hero-tag absolute left-0 top-0">From complexity</p>

      {inputs.map((input, index) => (
        <div
          key={input}
          data-ascii-anchor={`in${index}`}
          className="hero-input absolute left-0 -translate-y-1/2"
          style={{ top: `${32 + index * 18}%` }}
        >
          <span className="font-mono text-[10px] font-bold text-gold">0{index + 1}</span>
          <span className="font-heading text-sm font-semibold text-mist sm:text-base">{input}</span>
        </div>
      ))}

      <div
        data-ascii-anchor="node"
        data-ascii-clear
        className="absolute right-[1%] top-1/2 flex aspect-square w-[42%] -translate-y-1/2 flex-col items-center justify-center text-center"
      >
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-gold sm:text-[10px]">One system</span>
        <span className="mt-2 font-heading text-base font-bold leading-tight text-mist sm:text-xl lg:text-2xl">
          Connected<br />intelligence
        </span>
      </div>

      <p
        data-ascii-anchor="out"
        className="absolute bottom-0 right-0 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-lavender"
      >
        Real capability <ArrowUpRightIcon className="size-3.5" />
      </p>
    </div>
  );
}

export function About() {
  return (
    <section id="about" className="relative isolate overflow-hidden border-b border-line">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden" aria-hidden="true">
        <div className="hero-background-glow absolute -left-32 top-32 size-[32rem] rounded-full bg-lavender/[0.06] blur-3xl" />
        <div className="hero-background-glow hero-background-glow-offset absolute right-[8%] top-0 size-[28rem] rounded-full bg-lavender/[0.05] blur-3xl" />
      </div>
      <Container className="relative pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pt-16 xl:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14">
          <div data-ascii-clear>
            <p className="mb-7 flex items-center gap-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
              <span className="h-px w-8 bg-gold" aria-hidden="true" />
              <DecodeText text="AI & software engineering" mode="load" />
            </p>
            <h1 className="max-w-[12ch] font-heading text-5xl font-bold leading-[1.02] tracking-[-0.055em] text-mist sm:text-6xl lg:text-[4.25rem] xl:text-[5rem]">
              <DecodeText text={about.title} mode="load" delay={250} />
            </h1>
            <p className="mt-7 max-w-xl font-serif text-xl leading-snug text-lavender sm:text-2xl lg:text-[1.75rem]">
              <DecodeText text={about.lead} mode="load" delay={1000} />
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#contact" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-lavender px-5 font-semibold text-graphite transition-colors hover:bg-[var(--lavender-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender">
                {contact.cta} <ArrowUpRightIcon className="size-4" aria-hidden="true" />
              </a>
              <a href="#approach" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-graphite/60 px-5 font-semibold text-mist backdrop-blur-sm transition-colors hover:border-lavender hover:bg-lavender/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender">
                Our approach <ArrowDownIcon className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
          <HeroStage />
        </div>

        <div data-ascii-clear className="mt-16 grid gap-3 border-t border-line pt-6 md:grid-cols-3 lg:mt-20">
          {about.columns.map(({ label, title, body }, index) => (
            <div key={label} className="rounded-2xl border border-line bg-panel/70 p-6 transition-colors hover:border-lavender/50 hover:bg-elevated/70">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
                0{index + 1} · {label}
              </p>
              <h2 className="mt-5 max-w-[17ch] font-heading text-2xl font-semibold leading-tight text-mist">{title}</h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <a href="#intro" className="mx-auto mt-10 flex w-fit items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-lavender focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lavender">
          {about.scrollLabel} <ArrowDownIcon className="size-4" aria-hidden="true" />
        </a>
      </Container>
    </section>
  );
}
