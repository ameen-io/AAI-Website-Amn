import { contact, site } from "@/lib/version2-content";

export function Contact() {
  return (
    <section id="contact" className="g-section g-violet g-contact">
      <div className="g-wrap">
        <h2 className="g-display g-contact-title">
          <span data-asm="mosaic">{contact.title}</span>
          <span data-asm="text" className="g-cursor" aria-hidden="true">
            _
          </span>
        </h2>
        <p data-asm="text" className="g-body g-contact-body">
          {contact.body}
        </p>
        <a href={`mailto:${site.email}`} data-asm="text" data-frame className="g-btn g-contact-cta">
          {contact.cta}
          <span aria-hidden="true">-&gt;</span>
        </a>
        <p data-asm="text" className="g-label g-contact-meta">
          {site.domain} · {site.location}
        </p>
      </div>
    </section>
  );
}
