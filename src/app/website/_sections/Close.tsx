import type { CSSProperties } from "react";
import { Container, LinkButton, Section } from "../_components/ui";
import { CloseTicket } from "./CloseTicket";


export function Close() {
  return (
    <Section id="close" tone="paper" className="overflow-hidden bg-[var(--w-ember)] text-[var(--w-ink)]">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          <div>
            <h2 data-reveal className="w-display">
              Sell time. Keep all of it.
            </h2>
            <p data-reveal style={{ "--w-delay": "120ms" } as CSSProperties} className="w-lead mt-7 max-w-[480px]">
              Start with one counter. Every seat, slot and session accounted for, and no cut of your tickets.
            </p>
            <div data-reveal style={{ "--w-delay": "220ms" } as CSSProperties} className="mt-10 flex flex-wrap gap-3">
              <LinkButton href="/" variant="dark" arrow>
                Try the live demo
              </LinkButton>
              <LinkButton
                href="/sign-up"
                variant="ghost"
                className="shadow-[inset_0_0_0_1.5px_var(--w-ink)]! text-[var(--w-ink)]! hover:bg-[rgb(20_20_19/0.08)]!"
              >
                Create an account
              </LinkButton>
            </div>
          </div>
          <div data-reveal style={{ "--w-delay": "160ms" } as CSSProperties} className="flex justify-center lg:justify-end">
            <CloseTicket />
          </div>
        </div>
      </Container>
    </Section>
  );
}
