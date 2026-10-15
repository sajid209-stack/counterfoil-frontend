"use client";

import { Check } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, includedOf } from "./helpers";

/**
 * What each ticket buys: its note and its perks, one block per ticket type that
 * says anything, perks as a check list two columns wide from a tablet up.
 */
export function IncludedSection() {
  const ctx = usePage();
  const tiers = includedOf(ctx);
  if (tiers.length === 0) return null;
  const twoCols = ctx.layout !== "phone";

  return (
    <Section id="included" title={ctx.labels.included}>
      <div className="flex flex-col gap-4">
        {tiers.map((tier) => {
          const perks = (tier.perks ?? []).filter((p) => clean(p));
          return (
            <div key={tier.id} className="pg-card min-w-0 p-5 md:p-6">
              <h3 className="text-[16px] font-semibold leading-6">{tier.name}</h3>
              {clean(tier.description) && <p className="pg-meta mt-1">{tier.description}</p>}
              {perks.length > 0 && (
                <ul
                  className="mt-4 grid gap-x-8 gap-y-3"
                  style={{ gridTemplateColumns: twoCols ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}
                >
                  {perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-3 text-[15px] leading-6">
                      <Check
                        size={18}
                        strokeWidth={2.25}
                        className="mt-[3px] shrink-0"
                        style={{ color: "var(--pg-ink)" }}
                        aria-hidden
                      />
                      <span style={{ overflowWrap: "anywhere" }}>{perk}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
