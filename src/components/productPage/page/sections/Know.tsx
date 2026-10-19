"use client";

import { CalendarClock, CalendarX, Info, Smartphone, Zap, type LucideIcon } from "lucide-react";
import type { Product } from "@/lib/api/types";
import { usePage } from "../context";
import { Section } from "../Section";

/* `useKnowLines` builds the list in a fixed order: instant confirmation, the
   ticket by SMS, then the cancelling rule and the changing rule when the
   booking has them. The icons follow that same order. If the list ever stops
   matching, every line falls back to one neutral icon rather than a wrong one. */
function iconsFor(product: Product, count: number): LucideIcon[] {
  const pol = product.policies;
  const icons: LucideIcon[] = [Zap, Smartphone];
  if (pol?.cancellation === "free_until" || pol?.cancellation === "fee" || pol?.cancellation === "none") icons.push(CalendarX);
  if (pol?.reschedule === "until" && pol.rescheduleHours > 0) icons.push(CalendarClock);
  return icons.length === count ? icons : Array<LucideIcon>(count).fill(Info);
}

/** Good to know: the booking's policies as an icon list. */
export function KnowSection() {
  const { know, product, labels, style } = usePage();
  if (know.length === 0) return null;
  const icons = iconsFor(product, know.length);
  return (
    <Section id="know" title={labels.know}>
      <ul className="flex max-w-[68ch] flex-col gap-3">
        {know.map((line, i) => {
          const Icon = icons[i];
          return (
            <li key={i} className="flex items-start gap-3 text-[15px] leading-6">
              <Icon size={20} strokeWidth={style.stroke} className="mt-0.5 shrink-0" style={{ color: "var(--pg-ink)" }} aria-hidden />
              <span>{line}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
