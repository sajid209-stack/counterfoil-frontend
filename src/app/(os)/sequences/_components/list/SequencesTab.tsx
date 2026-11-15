"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Trash2, TriangleAlert } from "lucide-react";
import {
  ActionMenu,
  Button,
  Card,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSearch,
  Modal,
  StatusPill,
  Switch,
  useToast,
  type ActionMenuItem,
  type Column,
} from "@/components/ui";
import { PagePrimaryButton, type PagePrimary } from "@/components/ui/PageShell";
import { MetaParts, PhoneRow } from "@/components/ui/PhoneRow";
import { QuickTabs } from "@/components/ui/QuickTabs";
import { copySequence, deleteSequence, restoreSequence, setSequenceOn, type SequenceRow } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { SEQUENCE_IDEAS, sequenceProblems, sequenceSentence, stateOf, type SeqT, type SequenceState } from "@/lib/sequences";
import { STATE_TONE, StartTile } from "../kinds";
import { IdeaCard } from "./IdeaCard";

type Quick = "all" | SequenceState;
const QUICK: Quick[] = ["all", "on", "off", "unfinished"];
const FIRST_IDEAS = ["reminder", "review", "noShow"];

/**
 * The Sequences tab: every sequence with its sentence, how much it has run, and
 * the switch. A sequence that is not finished says what is missing and cannot
 * be switched on; switching off one that has runs waiting asks what to do with
 * them. With no sequences at all, the page is three ideas, not an empty table.
 */
export function SequencesTab({ rows, loading, primary }: { rows: SequenceRow[]; loading: boolean; primary: PagePrimary }) {
  const t = useTranslations("sequencesList");
  const ts = useTranslations("sequences");
  const tsx = ts as unknown as SeqT;
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);

  const [quick, setQuick] = useState<Quick>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [stopFor, setStopFor] = useState<SequenceRow | null>(null);

  const nameOf = (r: SequenceRow) => r.name.trim() || t("untitled");
  const sentenceOf = (r: SequenceRow) => sequenceSentence(tsx, r);
  const problemOf = (r: SequenceRow) => {
    const first = sequenceProblems(r)[0];
    return first ? ts(`problem.${first.code}`) : "";
  };

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => (quick === "all" || stateOf(r) === quick) && (!q || `${r.name} ${sentenceOf(r)}`.toLowerCase().includes(q)));
  const PAGE_SIZE = 50;
  const curPage = Math.min(page, Math.max(1, Math.ceil(shown.length / PAGE_SIZE)));
  const pageRows = shown.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const filtered = quick !== "all" || !!q;

  const withBusy = async (id: string, run: () => Promise<void>) => {
    setBusy((cur) => new Set(cur).add(id));
    try {
      await run();
    } finally {
      setBusy((cur) => {
        const next = new Set(cur);
        next.delete(id);
        return next;
      });
    }
  };

  const switchOff = (row: SequenceRow, stopWaiting: boolean) =>
    withBusy(row.id, async () => {
      const res = await setSequenceOn(row.id, false, stopWaiting ? { stopWaiting: true } : {});
      if (res.ok) toast.success(t("toast.off"));
      else toast.error(t("toast.failed"));
    });

  const flip = (row: SequenceRow, next: boolean) => {
    if (next) {
      return withBusy(row.id, async () => {
        const res = await setSequenceOn(row.id, true);
        if (res.ok) return toast.success(t("toast.on"));
        const code = res.error.fieldErrors?.status;
        toast.error(code ? t("toast.finishFirst", { problem: ts(`problem.${code}`) }) : t("toast.failed"));
      });
    }
    if (row.working > 0) {
      setStopFor(row);
      return;
    }
    return switchOff(row, false);
  };

  const duplicate = async (row: SequenceRow) => {
    const res = await copySequence(row.id, t("copyName", { name: nameOf(row) }));
    if (!res.ok) return toast.error(t("toast.failed"));
    toast.success(t("toast.copied", { name: res.data.name }));
    router.push(`/sequences/${res.data.id}`);
  };

  const remove = async (row: SequenceRow) => {
    const res = await deleteSequence(row.id);
    if (!res.ok) return toast.error(t("toast.failed"));
    const name = nameOf(row);
    toast.success(t("toast.deleted", { name }), {
      label: t("toast.undo"),
      run: async () => {
        const back = await restoreSequence(row.id);
        if (back.ok) toast.success(t("toast.restored", { name }));
        else toast.error(t("toast.failed"));
      },
    });
  };

  const actionsFor = (row: SequenceRow): ActionMenuItem[] => [
    { key: "open", label: t("action.open"), icon: <ExternalLink size={14} strokeWidth={1.5} />, onSelect: () => router.push(`/sequences/${row.id}`) },
    { key: "copy", label: t("action.copy"), icon: <Copy size={14} strokeWidth={1.5} />, onSelect: () => duplicate(row) },
    { key: "delete", label: t("action.delete"), icon: <Trash2 size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => remove(row) },
  ];

  /** The switch, or — for a sequence that is not finished — the pill and a switch that cannot move. */
  const onControl = (row: SequenceRow, withPill: boolean) => {
    const state = stateOf(row);
    if (state === "unfinished") {
      const why = t("notFinishedHint", { problem: problemOf(row) });
      return (
        <span className="flex items-center gap-tight" title={why}>
          {withPill && <StatusPill tone={STATE_TONE.unfinished}>{ts("state.unfinished")}</StatusPill>}
          <Switch checked={false} disabled aria-label={`${t("switchLabel", { name: nameOf(row) })}. ${why}`} />
        </span>
      );
    }
    return <Switch checked={state === "on"} disabled={busy.has(row.id)} onChange={(next) => flip(row, next)} aria-label={t("switchLabel", { name: nameOf(row) })} />;
  };

  const needLookLink = (row: SequenceRow, className: string) => (
    <Link
      href={`/sequences?tab=outbox&status=problem&sequence=${encodeURIComponent(row.id)}`}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {t("needLookRuns", { count: row.problems })}
    </Link>
  );

  const columns: Column<SequenceRow>[] = [
    {
      key: "sequence",
      header: t("col.sequence"),
      render: (r) => (
        <span className="flex min-w-0 items-start gap-comfortable py-inline">
          <StartTile kind={r.start.kind} size="md" />
          <span className="flex min-w-0 flex-1 flex-col gap-inline">
            <span className="line-clamp-2 break-words text-base font-medium text-fg">{nameOf(r)}</span>
            <span className="line-clamp-2 break-words text-sm text-muted">{sentenceOf(r)}</span>
            {stateOf(r) === "unfinished" && (
              <span className="flex min-w-0 items-center gap-inline text-sm text-warning">
                <TriangleAlert size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />
                <span className="min-w-0 truncate">{problemOf(r)}</span>
              </span>
            )}
            {r.problems > 0 && needLookLink(r, "w-fit text-sm text-danger underline underline-offset-4 hover:no-underline")}
          </span>
        </span>
      ),
    },
    {
      key: "runs",
      header: t("col.runs"),
      align: "right",
      width: "8.5rem",
      render: (r) => (
        <span className="flex flex-col items-end">
          <span className="font-medium text-fg">{r.runs30}</span>
          {r.working > 0 && <span className="text-sm text-muted">{t("working", { count: r.working })}</span>}
        </span>
      ),
    },
    {
      key: "last",
      header: t("col.lastRun"),
      width: "8rem",
      render: (r) => <span className="whitespace-nowrap text-fg-secondary">{r.lastRunAt ? formatRelative(r.lastRunAt, now) : t("never")}</span>,
    },
    {
      key: "on",
      header: t("col.on"),
      width: "11rem",
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()} className="flex">
          {onControl(r, true)}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("col.actions")}</span>,
      width: "3rem",
      render: (r) => (
        <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <ActionMenu items={actionsFor(r)} label={t("action.rows", { name: nameOf(r) })} />
        </span>
      ),
    },
  ];

  if (!loading && rows.length === 0) {
    return (
      <Card as="section" title={t("ideas.title")} actions={<Link href="/sequences/new" className="text-sm font-medium text-fg underline underline-offset-4 hover:no-underline">{t("ideas.all")}</Link>}>
        <p className="mb-section text-base text-muted">{t("ideas.body")}</p>
        <div className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
          {SEQUENCE_IDEAS.filter((i) => FIRST_IDEAS.includes(i.id)).map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onChoose={() => router.push("/sequences/new")} />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={pageRows}
        getRowId={(r) => r.id}
        loading={loading}
        layout="fixed"
        height="page"
        minWidth="46rem"
        onRowClick={(r) => router.push(`/sequences/${r.id}`)}
        cardVariant="list"
        phoneInset={`calc(var(--spacing-gutter) + 36px + var(--spacing-comfortable))`}
        renderCard={(r) => (
          <PhoneRow
            lead={<StartTile kind={r.start.kind} size="md" />}
            title={<span className="line-clamp-2 whitespace-normal break-words leading-snug">{nameOf(r)}</span>}
            meta={
              <MetaParts
                parts={[
                  sentenceOf(r),
                  stateOf(r) === "unfinished" ? <span key="p" className="text-warning">{problemOf(r)}</span> : null,
                  r.problems > 0 ? needLookLink(r, "text-danger underline underline-offset-4") : null,
                ]}
              />
            }
            pill={stateOf(r) === "unfinished" ? <StatusPill tone={STATE_TONE.unfinished}>{ts("state.unfinished")}</StatusPill> : null}
            trailing={
              <span onClick={(e) => e.stopPropagation()} className="flex">
                {onControl(r, false)}
              </span>
            }
            action={<ActionMenu items={actionsFor(r)} label={t("action.rows", { name: nameOf(r) })} />}
          />
        )}
        toolbar={
          <FilterBar
            pill
            tabs={
              <QuickTabs
                label={t("quick.label")}
                value={quick}
                onChange={(v) => {
                  setQuick(v);
                  setPage(1);
                }}
                options={QUICK.map((v) => ({ value: v, label: t(`quick.${v}`) }))}
              />
            }
            search={
              <FilterSearch
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                placeholder={t("search.sequences")}
                className="flex-1 md:flex-none"
              />
            }
            actions={<PagePrimaryButton primary={primary} />}
            filters={[]}
          />
        }
        emptyState={
          <EmptyState
            title={t("empty.title")}
            message={t("empty.message")}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setQuick("all");
                  }}
                >
                  {t("empty.clear")}
                </Button>
              ) : undefined
            }
          />
        }
        pagination={{ page: curPage, pageSize: PAGE_SIZE, total: shown.length, onPageChange: setPage }}
      />

      <Modal
        open={stopFor !== null}
        onClose={() => setStopFor(null)}
        size="sm"
        title={stopFor ? t("stop.title", { count: stopFor.working }) : undefined}
        footer={
          <div className="flex w-full flex-col gap-tight sm:flex-row sm:justify-end">
            <Button variant="tertiary" onClick={() => setStopFor(null)}>
              {t("stop.cancel")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const row = stopFor;
                setStopFor(null);
                if (row) switchOff(row, false);
              }}
            >
              {t("stop.letFinish")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const row = stopFor;
                setStopFor(null);
                if (row) switchOff(row, true);
              }}
            >
              {t("stop.stopNow")}
            </Button>
          </div>
        }
      />
    </>
  );
}
