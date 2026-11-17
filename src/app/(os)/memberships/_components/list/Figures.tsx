"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { MembershipSummary } from "@/lib/api";

export type ListTab = "active" | "ending" | "ended" | "paused" | "cancelled";

interface Figure {
  key: string;
  label: string;
  value: string;
  context?: string;
  warn?: boolean;
  /** A figure that is also a filter. */
  onPress?: () => void;
  pressed?: boolean;
}

/**
 * The four figures. A phone gets a sideways row of small cards; from md it is
 * one band divided by hairlines (the same shape as the other lists' figures).
 * Each card is `relative` so text inside one scrolled out of view cannot widen the page.
 */
export function Figures({ summary, tab, onTab }: { summary: MembershipSummary | undefined; tab: ListTab; onTab: (tab: ListTab) => void }) {
  const t = useTranslations("membershipsList.figures");
  const s = summary;
  const items: Figure[] = [
    { key: "members", label: t("members"), value: String(s?.active ?? 0), context: s && s.joinedThisMonth > 0 ? t("joined", { count: s.joinedThisMonth }) : undefined },
    { key: "month", label: t("eachMonth"), value: formatMoney(s?.monthlyValue ?? 0), context: t("fromMembers", { count: s?.active ?? 0 }) },
    { key: "soon", label: t("endingSoon"), value: String(s?.expiringSoon ?? 0), warn: (s?.expiringSoon ?? 0) > 0, context: t("next30"), onPress: () => onTab("ending"), pressed: tab === "ending" },
    { key: "ended", label: t("ended"), value: String(s?.lapsed ?? 0), context: t("didNotRenew"), onPress: () => onTab("ended"), pressed: tab === "ended" },
  ];

  return (
    <section
      aria-label={t("label")}
      className="no-scrollbar -mx-gutter flex snap-x snap-mandatory scroll-px-gutter gap-tight overflow-x-auto px-gutter pb-inline md:mx-0 md:grid md:snap-none md:grid-cols-4 md:gap-0 md:overflow-visible md:rounded-card md:bg-card md:px-0 md:pb-0 md:shadow-card md:divide-x md:divide-line"
    >
      {items.map((f) => {
        const body = (
          <>
            <span className="text-sm text-muted">{f.label}</span>
            {s ? (
              <span className={cn("text-xl font-semibold tabular-nums md:text-2xl", f.warn ? "text-warning" : "text-fg")}>{f.value}</span>
            ) : (
              <Skeleton h={28} w={80} />
            )}
            {s ? f.context && <span className="text-sm text-muted">{f.context}</span> : <Skeleton h={14} w={110} />}
          </>
        );
        const cls = cn(
          "card-surface relative flex w-44 shrink-0 snap-start flex-col items-start gap-inline p-comfortable text-left",
          "md:w-auto md:min-w-0 md:rounded-none md:border-0 md:bg-transparent md:p-card md:shadow-none",
        );
        return f.onPress ? (
          <button
            key={f.key}
            type="button"
            aria-pressed={f.pressed}
            onClick={f.onPress}
            className={cn(cls, "transition-colors duration-quick md:hover:bg-subtle", f.pressed && "bg-ember-wash md:bg-ember-wash")}
          >
            {body}
          </button>
        ) : (
          <div key={f.key} className={cls}>
            {body}
          </div>
        );
      })}
    </section>
  );
}
