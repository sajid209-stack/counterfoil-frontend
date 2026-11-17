"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { MembershipView } from "@/lib/api";

interface Event {
  key: string;
  title: string;
  note?: string;
  at: string;
}

/**
 * What has happened to this membership, newest first. Only events the record
 * actually carries: it has a join date, a start date, and the moment it was
 * paused or cancelled. Nothing is invented to fill the list.
 */
export function HistoryCard({ membership: m }: { membership: MembershipView }) {
  const t = useTranslations("membershipDetail.history");

  const events: Event[] = [];
  if (m.cancelledAt) events.push({ key: "cancelled", title: t("cancelled"), note: m.cancelReason ? t("reason", { reason: m.cancelReason }) : undefined, at: m.cancelledAt });
  if (m.effectiveStatus === "lapsed") events.push({ key: "ended", title: t("ended"), at: m.expiresAt });
  if (m.effectiveStatus === "paused" && m.pausedAt) events.push({ key: "paused", title: t("paused"), at: m.pausedAt });
  events.push({ key: "started", title: t("started"), at: m.startedAt });
  events.push({ key: "joined", title: t("joined"), at: m.createdAt });
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return (
    <Card title={t("title")}>
      <ol className="flex flex-col">
        {events.map((e, i) => (
          <li key={e.key} className="flex gap-comfortable">
            <span className="flex w-3 shrink-0 flex-col items-center">
              <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === 0 ? "bg-fg" : "bg-strong")} />
              {i < events.length - 1 && <span aria-hidden className="mt-inline w-px flex-1 bg-line" />}
            </span>
            <div className={cn("min-w-0 flex-1", i < events.length - 1 && "pb-section")}>
              <p className="text-base font-medium text-fg">{e.title}</p>
              <p className="text-sm text-muted">{formatDate(e.at)}</p>
              {e.note && <p className="mt-inline break-words text-sm text-muted">{e.note}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
