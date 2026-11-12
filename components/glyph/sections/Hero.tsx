import { about, contact } from "@/lib/version2-content";
import { art } from "../art";

export function Hero() {
  return (
    <section id="about" className="g-hero">
      <div className="g-wrap">
        <h1 data-asm="mosaic" className="g-display g-hero-title">
          {about.title}
        </h1>

        <div className="g-hero-grid">
          <div className="g-hero-copy">
            <p data-asm="text" className="g-lead">
              {about.lead}
            </p>
            <div className="g-hero-actions">
              <a href="#contact" data-asm="text" data-frame className="g-btn g-btn-primary">
                {contact.cta}
                <span aria-hidden="true">-&gt;</span>
              </a>
              <a href="#approach" data-asm="text" className="g-btn">
                <span aria-hidden="true">[</span>
                Our approach
                <span aria-hidden="true">↓ ]</span>
              </a>
            </div>
          </div>
          <pre data-asm="art" className="g-art g-hero-diagram" aria-hidden="true">
            {art.hero}
          </pre>
        </div>

        <div data-frame className="g-steps g-hero-steps">
          <span data-frame-label data-asm="text">
            AI &amp; software engineering
          </span>
          {about.columns.map(({ label, title, body }, index) => (
            <div key={label} className="g-step">
              <p data-asm="text" className="g-label g-step-label">
                0{index + 1} · {label}
              </p>
              <h2 data-asm="text" className="g-title">
                {title}
              </h2>
              <p data-asm="text" className="g-body">
                {body}
              </p>
              {index < about.columns.length - 1 && (
                <span data-asm="text" className="g-step-arrow" aria-hidden="true">
                  --&gt;
                </span>
              )}
            </div>
          ))}
        </div>

        <a href="#intro" data-asm="text" className="g-link g-scroll">
          {about.scrollLabel} ↓
        </a>
      </div>
    </section>
  );
}
