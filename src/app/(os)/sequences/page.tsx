"use client";

import { Suspense, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Notice, Tabs, tabPanelProps } from "@/components/ui";
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

  // No figures: the one number an owner must act on is a run that went wrong,
  // and that is a notice, shown only while it is true.
  const needLook = summary?.needLook ?? 0;

  const outboxKey = `${sp.get("status") ?? ""}|${sp.get("sequence") ?? ""}`;

  return (
    <PageShell title={t("title")} description={t("description")} primary={primary}>
      <div className="flex flex-col gap-section">
        {needLook > 0 && (
          <Notice tone="warning" size="sm" action={{ label: t("needLookShow"), onClick: () => go("outbox", { status: "problem" }) }}>
            {t("needLookNotice", { count: needLook })}
          </Notice>
        )}
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
