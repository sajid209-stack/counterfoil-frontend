"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { formatDay } from "@/lib/format";
import { runsByDay, useSequencesVersion } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import { RunsTable } from "../runs/RunsTable";
import { ymdOf } from "./walkOptions";

/** The last 14 days as thin bars, the figures, and this sequence's outbox. */
export function RunsTab({ id, runs30, working, problems }: { id: string; runs30: number; working: number; problems: number }) {
  const tb = useTranslations("sequenceBuilder");
  const version = useSequencesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the store changes under `version`
  const days = useMemo(() => runsByDay(id, 14), [id, version]);
  const top = Math.max(1, ...days);
  const end = demoNow();
  return (
    <div className="flex flex-col gap-section">
      <section className="card-surface p-card" aria-label={tb("runs.last14")}>
        <div className="flex h-12 items-end gap-inline" role="img" aria-label={tb("runs.last14")}>
          {days.map((n, i) => {
            const d = new Date(end.getTime() - (13 - i) * 86400000);
            return (
              <span
                key={i}
                title={tb("runs.bar", { count: n, date: formatDay(ymdOf(d)) })}
                style={{ height: n ? `${Math.max(12, (n / top) * 100)}%` : "8%" }}
                className={`min-w-0 flex-1 rounded-inner ${n ? "bg-ember" : "bg-ember-wash"}`}
              />
            );
          })}
        </div>
        <p className="mt-comfortable text-sm text-fg-secondary">{tb("runs.figures", { runs: runs30, working, problems })}</p>
      </section>
      <RunsTable sequenceId={id} />
    </div>
  );
}
