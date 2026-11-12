import { DecodeText } from "@/components/ascii/DecodeText";
import { Eyebrow, Section } from "@/components/version2/site/Section";
import { offer } from "@/lib/version2-content";

export function Offer() {
  return (
    <Section id="offer" tone="dark">
      <Eyebrow>{offer.eyebrow}</Eyebrow>
      <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-tight text-mist sm:text-5xl">
        <DecodeText text={offer.title} />
      </h2>

      {/* The glyph canvas draws one emblem per card in the empty top area:
          stacked platform layers, a start-to-finish braid, an engineer slotting into a team. */}
      <ul data-ascii-stage="offer" className="mt-12 grid gap-4 md:grid-cols-3">
        {offer.items.map(({ title, body }, i) => (
          <li
            key={title}
            className="flex flex-col rounded-2xl border border-line p-6 transition-colors hover:border-lavender/60"
          >
            <div data-ascii-anchor={`o${i}`} className="-mx-2 mb-4 h-32" aria-hidden="true" />
            <span className="font-mono text-xs font-bold text-gold">0{i + 1}</span>
            <h3 className="mt-4 text-xl font-bold text-mist">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
