import { intro } from "@/lib/version2-content";
import { art } from "../art";

export function Intro() {
  return (
    <section id="intro" className="g-section g-intro">
      <div className="g-wrap">
        <div data-frame className="g-panel g-intro-panel">
          <span data-frame-label data-asm="text">
            {intro.eyebrow}
          </span>
          <div className="g-intro-copy">
            <h2 data-asm="text" className="g-headline g-intro-title">
              {intro.title}
            </h2>
            <p data-asm="text" className="g-lead g-intro-body">
              {intro.body}
            </p>
          </div>
          <pre data-asm="art" className="g-art g-helix" aria-hidden="true">
            {art.helix}
          </pre>
        </div>
      </div>
    </section>
  );
}
