"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Inbox } from "lucide-react";
import { Button, DataTable, EmptyState, FilterBar, FilterSearch, StatusPill, type Column } from "@/components/ui";
import { MetaParts, PhoneRow } from "@/components/ui/PhoneRow";
import { QuickTabs } from "@/components/ui/QuickTabs";
import { formatDateTime, formatRelative } from "@/lib/format";
import { listSequenceRuns, useSequencesVersion } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { currentStep, type RunStatus, type SequenceRun } from "@/lib/sequences";
import { RUN_TONE, StepTile } from "../kinds";
import { RunSheet } from "./RunSheet";

const PAGE_SIZE = 20;
const STATUSES: (RunStatus | "all")[] = ["all", "working", "done", "stopped", "problem"];

const asStatus = (v: string | null): RunStatus | "all" => (STATUSES.includes(v as RunStatus | "all") && v ? (v as RunStatus | "all") : "all");

/**
 * The outbox: every run, who it was for, the step it is on and how it stands.
 * With `sequenceId` it is that one sequence's runs and the Sequence column is
 * not drawn (the builder's Runs tab). `?status=` sets the first filter.
 * `only` narrows to one sequence but keeps the column and says so, with a way
 * back to everything (the list's "n runs need a look" link).
 */
export function RunsTable({ sequenceId, only }: { sequenceId?: string; only?: string }) {
  return (
    <Suspense fallback={null}>
      <Runs sequenceId={sequenceId} only={only} />
    </Suspense>
  );
}

function Runs({ sequenceId, only }: { sequenceId?: string; only?: string }) {
  const t = useTranslations("sequencesList");
  const ts = useTranslations("sequences");
  const sp = useSearchParams();
  const version = useSequencesVersion();
  const now = useMemo(() => demoNow(), []);

  const [status, setStatus] = useState<RunStatus | "all">(() => asStatus(sp.get("status")));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [narrow, setNarrow] = useState<string | undefined>(only);
  const [openId, setOpenId] = useState<string | null>(null);

  const scopeId = sequenceId ?? narrow;
  const q = useApiQuery(
    () => listSequenceRuns({ sequenceId: scopeId, status, search, page, pageSize: PAGE_SIZE }),
    [scopeId, status, search, page, version],
  );
  const rows = q.data?.data ?? [];
  const total = q.data?.page.total ?? 0;
  const loading = q.loading && !q.data;
  const filtered = status !== "all" || !!search.trim();
  const narrowName = narrow && rows[0]?.sequenceName;

  const reset = () => {
    setStatus("all");
    setSearch("");
    setPage(1);
  };

  const stepLabel = (r: SequenceRun) => {
    const s = currentStep(r);
    if (!s) return { kind: "wait" as const, text: t("outbox.nothingYet"), until: null };
    return { kind: s.kind, text: ts(`step.${s.kind}.name`), until: r.status === "working" && s.status === "waiting" ? formatDateTime(s.at) : null };
  };

  const columns: Column<SequenceRun>[] = [
    {
      key: "when",
      header: t("col.when"),
      width: "8rem",
      render: (r) => (
        <span className="whitespace-nowrap text-fg-secondary" title={formatDateTime(r.touchedAt)}>
          {formatRelative(r.touchedAt, now)}
        </span>
      ),
    },
    {
      key: "who",
      header: t("col.who"),
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{r.who.name}</span>
          <span className="truncate text-sm text-muted">
            {r.who.booking}
            {r.who.orderRef && (
              <>
                {" · "}
                <span className="font-mono">{r.who.orderRef}</span>
              </>
            )}
          </span>
        </span>
      ),
    },
    ...(sequenceId
      ? []
      : [
          {
            key: "sequence",
            header: t("col.sequence"),
            render: (r: SequenceRun) => <span className="line-clamp-2 break-words text-fg-secondary">{r.sequenceName}</span>,
          } satisfies Column<SequenceRun>,
        ]),
    {
      key: "step",
      header: t("col.step"),
      render: (r) => {
        const s = stepLabel(r);
        return (
          <span className="flex min-w-0 items-center gap-tight">
            <StepTile kind={s.kind} size="sm" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-fg">{s.text}</span>
              {s.until && <span className="truncate text-sm text-muted">{t("outbox.until", { when: s.until })}</span>}
            </span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: t("col.status"),
      width: "9rem",
      render: (r) => <StatusPill tone={RUN_TONE[r.status]}>{ts(`run.status.${r.status}`)}</StatusPill>,
    },
  ];

  return (
    <>
      {narrow && (
        <div className="mb-comfortable flex flex-wrap items-center gap-tight text-sm text-muted">
          <span>{t("outbox.onlySequence", { name: narrowName || "…" })}</span>
          <Button variant="tertiary" size="sm" onClick={() => { setNarrow(undefined); setPage(1); }}>
            {t("outbox.showAll")}
          </Button>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={loading}
        layout="fixed"
        height="page"
        minWidth="44rem"
        onRowClick={(r) => setOpenId(r.id)}
        cardVariant="list"
        renderCard={(r) => {
          const s = stepLabel(r);
          return (
            <PhoneRow
              lead={<StepTile kind={s.kind} size="sm" />}
              title={r.who.name}
              meta={<MetaParts parts={[sequenceId ? null : r.sequenceName, formatRelative(r.touchedAt, now)]} />}
              pill={<StatusPill tone={RUN_TONE[r.status]}>{ts(`run.status.${r.status}`)}</StatusPill>}
            />
          );
        }}
        toolbar={
          <FilterBar
            pill
            tabs={
              <QuickTabs
                label={t("outbox.quickLabel")}
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
                options={STATUSES.map((s) => ({ value: s, label: t(`outbox.${s}`) }))}
              />
            }
            search={
              <FilterSearch
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder={t("search.runs")}
                className="flex-1 md:flex-none"
              />
            }
            filters={[]}
          />
        }
        emptyState={
          filtered ? (
            <EmptyState
              icon={<Inbox size={24} strokeWidth={1.5} aria-hidden />}
              title={t("outbox.filteredTitle")}
              message={t("outbox.filteredBody")}
              action={
                <Button variant="secondary" onClick={reset}>
                  {t("outbox.clear")}
                </Button>
              }
            />
          ) : (
            <EmptyState icon={<Inbox size={24} strokeWidth={1.5} aria-hidden />} title={t("outbox.emptyTitle")} message={t("outbox.emptyBody")} />
          )
        }
        pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
      />
      <RunSheet runId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
