import { offer } from "@/lib/version2-content";
import { art } from "../art";

export function Offer() {
  return (
    <section id="offer" className="g-section">
      <div className="g-wrap">
        <div data-frame="rule" className="g-rule">
          <span data-frame-label data-asm="text">
            {offer.eyebrow}
          </span>
        </div>
        <h2 data-asm="text" className="g-headline">
          {offer.title}
        </h2>

        <ul className="g-offer">
          {offer.items.map(({ title, body }, i) => (
            <li key={title} className="g-offer-item">
              <pre data-asm="art" className="g-art g-emblem" aria-hidden="true">
                {art.offer[i]}
              </pre>
              <p data-asm="text" className="g-label g-step-label">
                0{i + 1}
              </p>
              <h3 data-asm="text" className="g-title">
                {title}
              </h3>
              <p data-asm="text" className="g-body">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
