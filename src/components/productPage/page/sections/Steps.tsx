"use client";

import { useTranslations } from "next-intl";
import { usePage } from "../context";
import { Section } from "../Section";
import { stepsOf } from "./helpers";

/**
 * Steps — a numbered list (how it works / what you'll make), 2-3 columns on
 * desktop (docs/page-style.md §7).
 */
export function StepsSection() {
  const ctx = usePage();
  const t = useTranslations("eventPage");
  const steps = stepsOf(ctx);
  if (!steps) return null;
  const cols = ctx.layout === "phone" ? 1 : ctx.layout === "tablet" ? 2 : Math.min(3, steps.items.length);
  return (
    <Section id="steps" title={steps.title || t("sections.steps")}>
      <ol className="grid gap-6" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {steps.items.map((item, i) => (
          <li key={item.id} className="flex min-w-0 flex-col gap-1.5">
            <span
              className="flex size-8 items-center justify-center rounded-full text-[14px] font-semibold"
              style={{ background: "var(--ps-soft)", color: "var(--ps-ink)" }}
              aria-hidden
            >
              {i + 1}
            </span>
            <p className="mt-1 text-[16px] font-semibold leading-6">{item.title}</p>
            {item.detail && <p className="pg-meta pg-muted">{item.detail}</p>}
          </li>
        ))}
      </ol>
    </Section>
  );
}
