"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Radio } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { BookingWay } from "@/lib/catalog";

/** The ways a booking is booked, in the order the question lists them. The last
 *  three live behind "More ways". */
export const MAIN_WAYS: BookingWay[] = ["anyday", "settimes", "ondate", "byhour", "person"];
export const MORE_WAYS: BookingWay[] = ["course", "pack", "combined"];

/**
 * "How do people book it?" — one plain question, answered from a list.
 *
 * A radio list, not a gallery of cards (docs/catalog.md §10.3): each answer is a
 * title and one line saying what it means, and the details of the chosen answer
 * open directly underneath it, so the question and what it needs stay together.
 * The BT code behind an answer is derived and is never shown.
 *
 * It draws nothing but the list. What opens under each answer is passed in
 * (`details`), because that is the wizard's state and not this list's.
 */
export function WaysToBook({
  value,
  onChange,
  details,
  invalid,
  "aria-label": ariaLabel,
}: {
  value: BookingWay | null;
  onChange: (way: BookingWay) => void;
  /** What opens under the chosen answer. */
  details: Partial<Record<BookingWay, React.ReactNode>>;
  invalid?: boolean;
  "aria-label": string;
}) {
  const t = useTranslations("catalog.ways");
  const name = useId();
  const moreId = useId();
  /* The disclosure is open whenever one of its answers is chosen, so the choice
     is never hidden behind a closed list. */
  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreOpen || (value !== null && MORE_WAYS.includes(value));

  const row = (way: BookingWay) => {
    const chosen = value === way;
    return (
      <div key={way} className="border-t border-hairline first:border-t-0">
        <Radio
          name={name}
          value={way}
          checked={chosen}
          onChange={() => onChange(way)}
          invalid={invalid}
          label={<span className="font-medium">{t(`${way}.title`)}</span>}
          description={t(`${way}.helper`)}
        />
        {chosen && details[way] ? (
          <div className="mb-comfortable ml-11 flex min-w-0 flex-col gap-section border-l-2 border-ember-line pl-section md:ml-9">{details[way]}</div>
        ) : null}
      </div>
    );
  };

  return (
    <div role="radiogroup" aria-label={ariaLabel} aria-invalid={invalid || undefined} className="flex flex-col">
      {MAIN_WAYS.map(row)}
      <div className="border-t border-hairline">
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={showMore}
          aria-controls={moreId}
          className="flex min-h-11 w-full items-center gap-tight rounded-control px-inline text-left text-base font-medium text-brand-foreground hover:bg-muted-wash"
        >
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("transition-transform duration-quick", showMore && "rotate-180")} />
          {t("more")}
        </button>
        <div id={moreId} hidden={!showMore}>
          {MORE_WAYS.map(row)}
        </div>
      </div>
    </div>
  );
}
