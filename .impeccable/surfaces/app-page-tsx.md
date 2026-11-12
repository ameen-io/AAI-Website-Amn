---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/palette/[palette]/page.tsx"]
---

# Home page (ascii branch)

Scope: `/` and `/palette/*` (same look). Visitor mode: Persuade. Audience: enterprise buyers choosing an AI engineering partner (PRODUCT.md). Content is fixed: every word from `lib/version2-content.ts`, nothing invented.

## Direction contract

THESIS: Every piece of the page is assembled from ASCII characters that fly together as you scroll: headlines, paragraphs, labels, buttons, frames and diagrams. Scattered glyphs become content, which is the product's own story (complexity becoming connected intelligence). It refuses the category default of a dark gradient hero with a network graphic and rounded service cards.

OWN-WORLD: Cool paper ground (#eceeee) with carbon ink (#0c0d0f), one electric violet (#5a2bff) committed at page scale: the contact section is drenched violet, and the approach section runs in inverse video (paper on ink). One family only, Martian Mono, across its width and weight axes. Headlines are ASCII mosaics: the heading's own letterforms rasterised into a grid of small glyphs. Every container is an ASCII frame (+--LABEL--+) drawn in characters, buttons are bracketed [ action ], and there are no rounded corners, shadows or gradients.

STORY: The visitor sees chaos resolve into "Every industry runs on complexity.", understands ardbergai connects data, models and systems into one intelligence, sees their industry, and starts a conversation.

FIRST VIEWPORT: A title bar line (ardbergai / AI & software engineering / Hyderabad). The headline as an edge-to-edge glyph mosaic across about 60% of the viewport height. Below it, the violet lead line and [ Start a conversation ] on the left, and the converging-streams diagram (Data, Models, Systems into one system) in ASCII on the right. On load a glyph storm assembles it all within about 2s.

FORM: user-pinned direction ("ascii things come together to make every content of the section visible"), which beats the roll; seed key 65065c2d (assigned Card Sorter, set aside by the user's pin). Signature interaction: scroll-scrubbed assembly of every element from scattered glyphs (reverses on scroll up), plus mosaic headlines that shimmer and part around the cursor. Motion grammar: glyphs travel with fast ease-out, settle per character, and resolve before reading height; reduced motion shows everything assembled and static.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
