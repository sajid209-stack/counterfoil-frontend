"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CircleAlert } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { peekPastDueCollections } from "@/lib/api";

/**
 * Every money page says so when a collection is past due — the one state on
 * these screens that has a consequence if nobody acts, so it is not left to be
 * found on the collections list.
 */
export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("money");
  const due = peekPastDueCollections();
  const amount = due.reduce((s, c) => s + c.amount, 0);
  return (
    <>
      {due.length > 0 && (
        <div role="status" className="mx-gutter mt-section flex flex-wrap items-center gap-tight rounded-md border border-warning/40 bg-warning/5 px-card py-comfortable text-[13px]">
          <CircleAlert size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-warning" />
          <span className="min-w-0 flex-1 font-medium text-fg">{t("collections.pastDueBanner", { count: due.length, amount: formatMoney(amount) })}</span>
          <Link href={`/money/collections/${due[0].id}`} className="inline-flex min-h-11 items-center font-medium text-brand-foreground underline-offset-4 hover:underline md:min-h-0">
            {t("collections.pastDueAction")}
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
