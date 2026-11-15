"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Minus } from "lucide-react";
import { Button, Notice, Sheet, Skeleton, StatusPill, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { getSequenceRun, retrySequenceRun, useSequencesVersion } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import type { RunStep, RunStepStatus, SequenceRun } from "@/lib/sequences";
import { RUN_STEP_TONE, RUN_TONE, StepTile } from "../kinds";

/**
 * One run, as a record: who it was for and every step in order — what was sent
 * and when, what is still waiting, what was skipped and why. The words are the
 * words the customer got.
 */
export function RunSheet({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const t = useTranslations("sequencesList");
  const ts = useTranslations("sequences");
  const toast = useToast();
  const version = useSequencesVersion();
  const [retrying, setRetrying] = useState(false);

  // The query only matters while a run is open; with none it finds nothing and is ignored.
  const q = useApiQuery(() => getSequenceRun(runId ?? ""), [runId, version]);
  const run: SequenceRun | undefined = runId && q.data?.id === runId ? q.data : undefined;
  const failedToLoad = !!runId && !run && !q.loading && !!q.error;

  const retry = async () => {
    if (!run) return;
    setRetrying(true);
    const res = await retrySequenceRun(run.id);
    setRetrying(false);
    if (!res.ok) return toast.error(t("toast.failed"));
    toast.success(t("toast.sent"));
    q.reload();
  };

  return (
    <Sheet
      open={!!runId}
      onClose={onClose}
      title={run?.who.name ?? t("run.title")}
      closeLabel={t("close")}
      side
      lead={run ? <p className="text-sm text-muted">{run.sequenceName}</p> : undefined}
    >
      {!run ? (
        failedToLoad ? (
          <div className="p-card">
            <Notice tone="danger" size="sm">
              {t("run.loadFailed")}
            </Notice>
          </div>
        ) : (
          <div className="flex flex-col gap-section p-card" aria-busy>
            <Skeleton h={20} w="60%" />
            <Skeleton h={64} />
            <Skeleton h={64} />
            <Skeleton h={64} />
          </div>
        )
      ) : (
        <div className="flex flex-col gap-major p-card">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-section gap-y-tight text-base">
            <dt className="text-muted">{t("col.status")}</dt>
            <dd>
              <StatusPill tone={RUN_TONE[run.status]}>{ts(`run.status.${run.status}`)}</StatusPill>
            </dd>
            <dt className="text-muted">{t("run.started")}</dt>
            <dd className="text-fg">{formatDateTime(run.startedAt)}</dd>
            <dt className="text-muted">{t("run.booking")}</dt>
            <dd className="min-w-0 break-words text-fg">{run.who.booking}</dd>
            {run.who.orderRef && run.who.orderId && (
              <>
                <dt className="text-muted">{t("run.order")}</dt>
                <dd>
                  <Link href={`/orders/${run.who.orderId}`} className="font-mono text-sm font-medium text-fg underline underline-offset-4 hover:no-underline">
                    {run.who.orderRef}
                  </Link>
                </dd>
              </>
            )}
            <dt className="sr-only">{t("run.openSequence")}</dt>
            <dd className="col-span-2">
              <Link href={`/sequences/${run.sequenceId}`} className="inline-flex min-h-11 items-center gap-inline text-sm font-medium text-fg underline underline-offset-4 hover:no-underline md:min-h-0">
                {t("run.openSequence")}
                <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
              </Link>
            </dd>
          </dl>

          {run.stopped && (
            <Notice tone="info" size="sm">
              {ts(`run.stopped.${run.stopped}`)}
            </Notice>
          )}

          <section aria-labelledby="run-history" className="flex flex-col gap-comfortable">
            <h3 id="run-history" className="text-md font-semibold text-fg">
              {t("run.history")}
            </h3>
            <ol className="flex flex-col">
              {run.steps.map((step, i) => (
                <TimelineRow key={`${step.stepId}-${i}`} step={step} last={i === run.steps.length - 1} onRetry={retry} retrying={retrying} />
              ))}
            </ol>
          </section>
        </div>
      )}
    </Sheet>
  );
}

function Dot({ status }: { status: RunStepStatus }) {
  const base = "mt-1 grid size-3 shrink-0 place-items-center rounded-full";
  if (status === "done") return <span aria-hidden className={cn(base, "bg-success")} />;
  if (status === "failed") return <span aria-hidden className={cn(base, "bg-danger")} />;
  if (status === "waiting") return <span aria-hidden className={cn(base, "border-2 border-info bg-card text-info")} />;
  if (status === "skipped")
    return (
      <span aria-hidden className={cn(base, "border border-line bg-card text-muted")}>
        <Minus size={8} strokeWidth={2} />
      </span>
    );
  return <span aria-hidden className={cn(base, "border border-line bg-card")} />;
}

function TimelineRow({ step, last, onRetry, retrying }: { step: RunStep; last: boolean; onRetry: () => void; retrying: boolean }) {
  const t = useTranslations("sequencesList");
  const ts = useTranslations("sequences");
  // A record says what happened. A step still to come has no words and no answer yet:
  // the pill says "Not yet" and that is all there is to say about it.
  const ahead = step.status === "next";
  const hasWords = !ahead && (step.kind === "text" || step.kind === "email" || step.kind === "team" || step.kind === "note") && !!step.words;
  const moment = step.status === "waiting" ? t("run.waitingUntil", { when: formatDateTime(step.at) }) : ahead ? null : formatDateTime(step.at);

  return (
    <li className={cn("flex gap-comfortable", step.side && "ms-section")}>
      <span className="flex w-3 shrink-0 flex-col items-center">
        <Dot status={step.status} />
        {!last && <span aria-hidden className="mt-inline w-px flex-1 bg-line" />}
      </span>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-tight", !last && "pb-section")}>
        <div className="flex min-w-0 items-center gap-tight">
          <StepTile kind={step.kind} size="sm" />
          <span className={cn("min-w-0 flex-1 text-base font-medium", ahead ? "text-muted" : "text-fg")}>
            {ts(`step.${step.kind}.name`)}
            {step.side && <span className="ms-tight text-sm font-normal text-muted">{ts(`step.branch.${step.side}`)}</span>}
          </span>
          <StatusPill tone={RUN_STEP_TONE[step.status]} size="sm">
            {ts(`run.step.${step.status}`)}
          </StatusPill>
        </div>
        {moment && <p className="text-sm text-muted">{moment}</p>}

        {hasWords && (
          <div className="rounded-control border border-line bg-subtle p-comfortable text-sm">
            {step.kind === "email" && step.subject && <p className="mb-inline font-medium text-fg">{step.subject}</p>}
            <p className="whitespace-pre-wrap text-fg">{step.words}</p>
          </div>
        )}
        {step.held && !ahead && <p className="text-sm text-muted">{ts("run.held")}</p>}
        {step.status === "skipped" && step.reason && <p className="text-sm text-muted">{ts(`run.reason.${step.reason}`)}</p>}
        {step.status === "failed" && (
          <div className="flex flex-wrap items-center gap-tight">
            <p className="text-sm text-danger">{ts("run.reason.sendFailed")}</p>
            <Button size="sm" variant="secondary" loading={retrying} onClick={onRetry}>
              {t("run.tryAgain")}
            </Button>
          </div>
        )}
        {step.kind === "branch" && step.took && step.status === "done" && <p className="text-sm text-fg-secondary">{t("run.checked", { took: ts(`run.took.${step.took}`) })}</p>}
      </div>
    </li>
  );
}
