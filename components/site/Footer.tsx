import { footer, site } from "@/lib/version2-content";
import { Container } from "@/components/version2/site/Container";

export function Footer() {
  return (
    <footer className="border-t border-dashed border-line bg-graphite py-8">
      <Container className="flex max-w-[1320px] flex-col gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p data-asm="text">
          © {site.name} · {footer.tagline}
        </p>
        <p data-asm="text">
          {site.domain} · {site.location}
        </p>
      </Container>
    </footer>
  );
}
