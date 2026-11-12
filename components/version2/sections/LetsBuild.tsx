import { ArrowRightIcon } from "lucide-react";
import { DecodeText } from "@/components/ascii/DecodeText";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/version2/site/Section";
import { contact, site } from "@/lib/version2-content";

export function LetsBuild() {
  return (
    <Section id="contact" tone="dark" className="text-center">
      {/* Every glyph on the page spirals into this one blinking cursor. */}
      <h2 data-ascii-stage="collapse" className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-mist sm:text-6xl">
        <DecodeText text={contact.title} />
        <span data-ascii-anchor="cursor" className="ascii-cursor" aria-hidden="true" />
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{contact.body}</p>
      <Button
        render={<a href={`mailto:${site.email}`} />}
        nativeButton={false}
        className="mt-8 h-12 gap-2 rounded-lg bg-lavender px-6 text-base font-semibold text-graphite hover:bg-[var(--lavender-hover)]"
      >
        {contact.cta}
        <ArrowRightIcon />
      </Button>
      <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-gold">
        {site.domain} · {site.location}
      </p>
    </Section>
  );
}
