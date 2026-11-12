import Link from "next/link";
import { industries, industryAnchor } from "@/lib/version2-content";
import { industryGlyphs } from "../industry-glyphs";

export function Industries() {
  const count = String(industries.items.length).padStart(2, "0");

  return (
    <section id="industries" className="g-section">
      <div className="g-wrap">
        <div data-frame="rule" className="g-rule">
          <span data-frame-label data-asm="text">
            {industries.eyebrow}
          </span>
        </div>
        <div className="g-industries-head">
          <h2 className="g-headline g-industries-title">
            <span data-asm="text" className="block">
              {industries.titleLines[0]}
            </span>
            <span data-asm="text" className="block g-accent">
              {industries.titleLines[1]}
            </span>
          </h2>
          <p data-asm="text" className="g-body">
            {industries.description}
          </p>
        </div>

        <div className="g-industries-bar">
          <span data-asm="text" className="g-label">
            Explore {count} industries
          </span>
          <span data-asm="text" className="g-label">
            Scroll to explore ↓
          </span>
        </div>

        <div className="g-industry-grid">
          {industries.items.map(({ title, body, signals }, index) => {
            const number = String(index + 1).padStart(2, "0");
            return (
              <article key={title} id={industryAnchor(title)} data-frame className="g-industry">
                <span data-frame-label data-asm="text">
                  {number} / {count}
                </span>
                <span data-frame-label="right" data-asm="text">
                  Industry systems
                </span>
                <div className="g-industry-art" aria-hidden="true">
                  <span data-asm="text" className="g-label">
                    Industry / {number}
                  </span>
                  <pre data-asm="art" className={`g-art g-industry-icon ${index % 2 ? "g-accent" : ""}`}>
                    {(industryGlyphs[index] ?? industryGlyphs[0]).join("\n")}
                  </pre>
                  <span data-asm="text" className="g-label g-industry-signal">
                    [ {signals[0]} ]
                  </span>
                </div>
                <div className="g-industry-copy">
                  <h3 data-asm="text" className="g-title">
                    {title}
                  </h3>
                  <p data-asm="text" className="g-body">
                    {body}
                  </p>
                  <p data-asm="text" className="g-label g-industry-signals">
                    {signals.join(" / ")}
                  </p>
                  <Link href="#contact" data-asm="text" className="g-link g-industry-link">
                    Discuss this industry -&gt;
                  </Link>
                </div>
              </article>
            );
          })}

          {/* The tenth cell: an open slot for an industry not listed. */}
          <div data-frame className="g-beyond">
            <p data-asm="text" className="g-title">
              {industries.beyond}
            </p>
            <Link href="#contact" data-asm="text" className="g-btn g-btn-primary">
              <span aria-hidden="true">[</span>
              Let&apos;s talk
              <span aria-hidden="true">-&gt; ]</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
