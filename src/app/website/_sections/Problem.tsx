import type { CSSProperties, ReactNode } from "react";
import { Container, ChapterHead, Section } from "../_components/ui";
import { ClashArt, NoGuideArt, StubArt } from "./ProblemArt";
import { ProblemAsk } from "./ProblemAsk";

const PAINS: { art: ReactNode; title: string; body: string }[] = [
  { art: <ClashArt />, title: "A court sold twice for the same hour", body: "Two teams arrive. One goes home." },
  { art: <NoGuideArt />, title: "A tour sold with no guide free", body: "The booking stands; the tour does not." },
  { art: <StubArt />, title: "A ticket nobody at the gate can check", body: "A paper stub passes from hand to hand." },
];

export function Problem() {
  return (
    <Section id="problem" tone="paper">
      <Container>
        <ChapterHead
          n="01"
          eyebrow="The problem"
          title="Venues sell time with tools built for shelves."
          lead="A retail till knows a product. It doesn’t know 6 PM."
        />
        <div className="mt-14 grid gap-5 md:mt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
          <ul className="grid gap-4">
            {PAINS.map((p, i) => (
              <li
                key={p.title}
                data-reveal
                style={{ "--w-delay": `${i * 100}ms` } as CSSProperties}
                className="w-panel grid gap-4 p-4 sm:grid-cols-[minmax(0,230px)_1fr] sm:items-center sm:gap-6"
              >
                {p.art}
                <div className="px-1 pb-1 sm:pb-0 sm:pr-4">
                  <h3 className="w-h3">{p.title}</h3>
                  <p className="mt-1.5 text-[15px] text-[var(--w-muted)]">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div data-reveal style={{ "--w-delay": "200ms" } as CSSProperties} className="h-full min-h-[460px]">
            <ProblemAsk />
          </div>
        </div>
      </Container>
    </Section>
  );
}
