import { DecodeText } from "@/components/ascii/DecodeText";
import { Eyebrow, Section } from "@/components/version2/site/Section";
import { intro } from "@/lib/version2-content";

export function Intro() {
  return (
    <Section id="intro" className="bg-panel">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:gap-16">
        <div data-ascii-clear>
          <Eyebrow>{intro.eyebrow}</Eyebrow>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
            <DecodeText text={intro.title} />
          </h2>
          <p className="mt-6 max-w-2xl font-serif text-xl italic text-muted-foreground sm:text-2xl">{intro.body}</p>
        </div>
        {/* Life sciences: the glyph canvas prints a double helix here as the section scrolls in. */}
        <div data-ascii-stage="helix" className="h-36 sm:h-44 lg:h-[380px]" aria-hidden="true" />
      </div>
    </Section>
  );
}
