"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { StatStrip, Tabs, tabPanelProps, type StatItem } from "@/components/ui";
import { PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { getSequenceSummary, listSequenceRuns, listSequences, useSequencesVersion } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { RunsTable } from "./_components/runs/RunsTable";
import { SequencesTab } from "./_components/list/SequencesTab";

type TabId = "sequences" | "outbox";

export default function SequencesPage() {
  return (
    <Suspense fallback={null}>
      <SequencesView />
    </Suspense>
  );
}

/**
 * Sequences — steps Counterfoil does for you (docs/sequences.md 5.1). One page,
 * two tabs: the sequences themselves, and the outbox of what they have sent and
 * are still waiting to send. The tab, and the outbox's first filter, live in the
 * address so a link ("3 runs need a look") lands where it says.
 */
function SequencesView() {
  const t = useTranslations("sequencesList");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const version = useSequencesVersion();

  const tab: TabId = sp.get("tab") === "outbox" ? "outbox" : "sequences";
  const go = useCallback(
    (next: TabId, extra: Record<string, string> = {}) => {
      const qs = new URLSearchParams();
      if (next === "outbox") qs.set("tab", "outbox");
      for (const [k, v] of Object.entries(extra)) qs.set(k, v);
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const summaryQ = useApiQuery(() => getSequenceSummary(), [version]);
  const listQ = useApiQuery(() => listSequences(), [version]);
  const runsQ = useApiQuery(() => listSequenceRuns({ pageSize: 1 }), [version]);

  const summary = summaryQ.data;
  const rows = listQ.data ?? [];
  const primary: PagePrimary = { label: t("newSequence"), href: "/sequences/new" };

  const needLook = summary?.needLook ?? 0;
  const figures: StatItem[] = [
    {
      key: "on",
      label: t("figures.on"),
      value: summary?.on ?? 0,
      context: summary && summary.working > 0 ? t("figures.working", { count: summary.working }) : undefined,
    },
    { key: "runsWeek", label: t("figures.runsWeek"), value: summary?.runsWeek ?? 0 },
    { key: "sent", label: t("figures.sent"), value: summary?.sentWeek ?? 0, context: t("figures.sentContext") },
    {
      key: "needLook",
      label: t("figures.needLook"),
      value: needLook,
      tone: needLook > 0 ? "warning" : undefined,
      context: needLook > 0 ? t("figures.needLookContext") : undefined,
      onClick: needLook > 0 ? () => go("outbox", { status: "problem" }) : undefined,
    },
  ];

  const outboxKey = `${sp.get("status") ?? ""}|${sp.get("sequence") ?? ""}`;

  return (
    <PageShell title={t("title")} description={t("description")} primary={primary}>
      <div className="flex flex-col gap-section">
        <StatStrip items={figures} loading={summaryQ.loading && !summary} />
        <Tabs
          id="sequences-tabs"
          aria-label={t("tabs.label")}
          value={tab}
          onChange={(v) => go(v as TabId)}
          items={[
            { value: "sequences", label: t("tabs.sequences"), count: listQ.data ? rows.length : undefined },
            { value: "outbox", label: t("tabs.outbox"), count: runsQ.data?.page.total },
          ]}
        />
        <div {...tabPanelProps("sequences-tabs", tab)}>
          {tab === "sequences" ? (
            <SequencesTab rows={rows} loading={listQ.loading && !listQ.data} primary={primary} />
          ) : (
            <RunsTable key={outboxKey} only={sp.get("sequence") ?? undefined} />
          )}
        </div>
      </div>
    </PageShell>
  );
}
