import { DecodeText } from "@/components/ascii/DecodeText";
import { cn } from "@/lib/utils";
import { Container } from "./Container";

type SectionProps = React.ComponentProps<"section"> & {
  id: string;
  /** Raised graphite section with light text. */
  tone?: "light" | "dark";
};

export function Section({ tone = "light", className, children, ...props }: SectionProps) {
  return (
    <section
      className={cn("py-20 sm:py-28", tone === "dark" && "bg-panel text-mist", className)}
      {...props}
    >
      {/* Content sits above the fixed ASCII canvas; the section background stays below it. */}
      <Container className="relative z-[1]">{children}</Container>
    </section>
  );
}

/** Small mono label above a section title. Plain-string labels decode from glyphs on scroll. */
export function Eyebrow({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-gold", className)}
      {...props}
    >
      {typeof children === "string" ? <DecodeText text={children} /> : children}
    </p>
  );
}
