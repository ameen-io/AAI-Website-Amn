import { GlyphCanvas } from "@/components/glyph/GlyphCanvas";
import { Approach } from "@/components/glyph/sections/Approach";
import { Contact } from "@/components/glyph/sections/Contact";
import { Hero } from "@/components/glyph/sections/Hero";
import { Industries } from "@/components/glyph/sections/Industries";
import { Intro } from "@/components/glyph/sections/Intro";
import { Offer } from "@/components/glyph/sections/Offer";
import "@/components/glyph/glyph.css";

/**
 * ASCII remake: every section is assembled from scattered glyphs as it
 * scrolls in. The original version-2 sections remain in components/version2.
 */
export function HomeSections() {
  return (
    <>
      <GlyphCanvas />
      <Hero />
      <Intro />
      <Approach />
      <Offer />
      <Industries />
      <Contact />
    </>
  );
}
