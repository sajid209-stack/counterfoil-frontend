import { ChapterHead, Container, Section } from "../_components/ui";
import { TypesChooser } from "./TypesChooser";
import { TypesGrid } from "./TypesGrid";

/** 04 · What you can sell. Three plain questions in, a kind of booking out. */
export function Types() {
  return (
    <Section id="types" tone="white">
      <Container>
        <ChapterHead
          n="04"
          eyebrow="What you can sell"
          title="Fourteen ways to sell time, from one engine."
          lead="Answer a few plain questions and Counterfoil works out the rest. No booking-type codes, ever. One engine sits behind all of them, so a court and a concert cannot sell the same hour twice."
        />
        <TypesChooser />
        <h3 className="sr-only">All fourteen</h3>
        <TypesGrid />
      </Container>
    </Section>
  );
}
