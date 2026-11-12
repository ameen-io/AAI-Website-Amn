import { approach } from "@/lib/version2-content";
import { art } from "../art";

export function Approach() {
  return (
    <section id="approach" className="g-section g-ink">
      <div className="g-wrap">
        <div data-frame="rule" className="g-rule">
          <span data-frame-label data-asm="text">
            {approach.eyebrow}
          </span>
        </div>
        <h2 data-asm="text" className="g-headline">
          {approach.title}
        </h2>

        <div
          className="g-cluster"
          role="img"
          aria-label="Five disconnected sources converge through ArdbergAI into one connected intelligence."
        >
          <div className="g-cluster-head" aria-hidden="true">
            <span data-asm="text" className="g-label">
              01 / Scattered inputs
            </span>
            <span data-asm="text" className="g-label g-cluster-out">
              02 / Connected outcome
            </span>
          </div>
          <div className="g-cluster-body" aria-hidden="true">
            <div className="g-cluster-art">
              <pre data-asm="art" className="g-art g-cluster-wide">
                {art.clusterWide}
              </pre>
              <pre data-asm="art" className="g-art g-cluster-narrow">
                {art.clusterNarrow}
              </pre>
            </div>
            <div data-frame className="g-result">
              <span data-frame-label data-asm="text">
                Unified system -&gt;
              </span>
              <pre data-asm="art" className="g-art g-bars">
                {art.bars}
              </pre>
              <p data-asm="text" className="g-result-title">
                One connected intelligence.
              </p>
              <p data-asm="text" className="g-body">
                Clear signals. Useful decisions.
              </p>
            </div>
          </div>
          <p data-asm="text" className="g-label g-cluster-foot" aria-hidden="true">
            * Complexity, connected into capability
          </p>
        </div>

        <ol className="g-steps g-approach-steps">
          {approach.steps.map(({ title, body }, i) => (
            <li key={title} className="g-step">
              <p data-asm="text" className="g-label g-step-label">
                [0{i + 1}]
              </p>
              <h3 data-asm="text" className="g-title">
                {title}
              </h3>
              <p data-asm="text" className="g-body">
                {body}
              </p>
              {i < approach.steps.length - 1 && (
                <span data-asm="text" className="g-step-arrow" aria-hidden="true">
                  --&gt;
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
