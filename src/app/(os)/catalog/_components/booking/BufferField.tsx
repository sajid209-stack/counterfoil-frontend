"use client";

import { useTranslations } from "next-intl";
import { DurationInput } from "@/components/ui";
import { formatClockMin, formatClockRange } from "@/lib/format";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";

const CHIPS = [0, 5, 10, 15, 30];

// A plain illustrative pair of times (7:00 – 8:00 PM) — just to show the
// shape of the gap under the field. Never real schedule data.
const EXAMPLE_START = 19 * 60;
const EXAMPLE_END = 20 * 60;

/**
 * "Time between bookings" — the one field every time-slot booking needs: a
 * field, court or lane; a timed session or show; a guided tour; an
 * appointment with a person. At 0 the next booking can start the instant one
 * ends; above 0 the place (or person) is kept clear for cleaning or
 * changeover. Chips FILL the field — they are not the only choices, so a
 * 7-minute turnaround is still one tap and a type away.
 *
 * Inspired by Calendly's buffers, Acuity's padding and Square Appointments'
 * processing time — stated in the operator's own words either way.
 */
export function BufferField({
  value,
  onChange,
  noun,
  className,
}: {
  value: number;
  onChange: (minutes: number) => void;
  /** The operator's own word for what is kept free — "lane", "court",
   *  "therapist" — already lower-cased. Falls back to a plain "place". */
  noun?: string;
  className?: string;
}) {
  const t = useTranslations("catalog.fields");
  const { dur } = useCatalogFormat();
  const word = (noun?.trim() || t("bufferDefaultNoun")).toLowerCase();
  const help = value > 0 ? t("bufferHelpValue", { noun: word, time: dur(value) }) : t("bufferHelpZero");
  const nextStart = EXAMPLE_END + value;
  const preview =
    value > 0
      ? t("bufferPreviewWithGap", { range: formatClockRange(EXAMPLE_START, EXAMPLE_END), gap: dur(value), next: formatClockMin(nextStart) })
      : t("bufferPreviewNoGap", { range: formatClockRange(EXAMPLE_START, EXAMPLE_END) });

  return (
    <div className={className}>
      <DurationInput label={t("bufferLabel")} value={value} min={0} step={5} onChange={onChange} chips={CHIPS} help={help} />
      {/* The tiny visual — decorative beside the help line above, which
          already says the same thing in words. */}
      <p aria-hidden className="mt-tight text-[12px] tabular-nums text-muted">{preview}</p>
    </div>
  );
}
