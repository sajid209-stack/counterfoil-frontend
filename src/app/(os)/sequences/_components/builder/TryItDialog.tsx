"use client";

import { useMemo, useState } from "react";
import { Clock, ShieldCheck } from "lucide-react";
import { Button, ChoiceCard, Modal, Notice, StatusPill } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { trySamples } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import { conditionSentence, findStep, needsYes, sequenceProblems, spanWords, stepTitle, walkSequence, type SequenceSample, type WalkRow } from "@/lib/sequences";
import { StepTile } from "../kinds";
import { useBuilder } from "./context";
import { walkOptions } from "./walkOptions";

function SampleRow({ s, selected, onPick }: { s: SequenceSample; selected: boolean; onPick: () => void }) {
  const { form, tb } = useBuilder();
  const opts = walkOptions("");
  const visit = new Date(s.visitAt);
  const flags = [
    s.owed > 0 ? tb("try.owes", { owed: formatMoney(s.owed) }) : "",
    !s.hasPhone ? tb("try.noPhone") : needsYes(form.start) && !s.canText ? tb("try.noText") : "",
    s.people >= 6 ? tb("try.group", { n: s.people }) : "",
  ].filter(Boolean);
  return (
    <ChoiceCard selected={selected} onClick={onPick} hideCheck className="w-full p-comfortable">
      <span className="block break-words text-base font-medium text-fg">{s.name}</span>
      {s.booking && (
        <span className="block break-words text-sm text-muted">
          {s.booking} · {opts.day(visit)}, {opts.clock(visit)}
        </span>
      )}
      {flags.length > 0 && <span className="block text-xs text-muted">{flags.join(" · ")}</span>}
    </ChoiceCard>
  );
}

function Row({ row, venue }: { row: WalkRow; venue: string }) {
  const { form, ts, tb } = useBuilder();
  const step = findStep(form.steps, row.stepId)?.step;
  if (!step) return null;
  const opts = walkOptions(venue);
  const when = `${opts.day(row.at)}, ${opts.clock(row.at)}`;

  if (step.kind === "wait")
    return (
      <li className="flex items-center gap-tight pl-section text-sm text-muted">
        <Clock size={14} strokeWidth={1.5} aria-hidden />
        {tb("try.wait", { span: spanWords(ts, step.minutes), when })}
      </li>
    );

  return (
    <li className="flex gap-comfortable">
      <div className="w-24 shrink-0 text-sm">
        <p className="font-medium text-fg">{opts.day(row.at)}</p>
        <p className="text-fg-secondary">{opts.clock(row.at)}</p>
        {row.after > 0 && <p className="text-xs text-muted">+{spanWords(ts, row.after)}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-tight">
          <StepTile kind={step.kind} size="sm" />
          <p className="min-w-0 break-words text-base font-medium text-fg">{stepTitle(ts, step)}</p>
          {row.skipped && <StatusPill tone="warning">{ts("run.step.skipped")}</StatusPill>}
        </div>
        {step.kind === "branch" && row.took && <p className="mt-inline text-sm text-muted">{tb("try.checked", { answer: ts(`run.took.${row.took}`) })}</p>}
        {row.skipped && <p className="mt-inline text-sm text-warning">{ts(`run.reason.${row.skipped}`)}</p>}
        {row.held && <p className="mt-inline text-sm text-muted">{ts("run.held")}</p>}
        {(row.words !== undefined || row.subject !== undefined) && (
          <div className={`mt-tight whitespace-pre-wrap break-words rounded-control border border-line bg-subtle p-comfortable text-sm ${row.skipped ? "text-muted" : "text-fg"}`}>
            {row.subject !== undefined && <p className="font-medium">{row.subject}</p>}
            {row.words}
          </div>
        )}
      </div>
    </li>
  );
}

export function TryItDialog({ onClose }: { onClose: () => void }) {
  const { form, ts, tb, venue } = useBuilder();
  const samples = useMemo(() => trySamples(form.start.kind).slice(0, 5), [form.start.kind]);
  const [pick, setPick] = useState(0);
  const sample = samples[pick] ?? samples[0];
  const walk = useMemo(() => (sample ? walkSequence(form, sample, demoNow(), walkOptions(venue)) : null), [form, sample, venue]);
  const opts = walkOptions(venue);
  const unfinished = sequenceProblems(form).length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={tb("try.title")}
      description={tb("try.description")}
      footer={
        <div className="flex w-full items-center justify-between gap-tight">
          <p className="flex items-center gap-tight text-sm text-muted">
            <ShieldCheck size={14} strokeWidth={1.5} aria-hidden />
            {tb("try.nothingSent")}
          </p>
          <Button variant="secondary" onClick={onClose}>
            {tb("close")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-section">
        {unfinished && (
          <Notice tone="warning" size="sm">
            {tb("try.unfinished")}
          </Notice>
        )}
        <div className="grid gap-section sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div className="flex flex-col gap-tight">
            <h3 className="text-sm font-medium text-muted">{tb("try.choose")}</h3>
            {samples.map((s, i) => (
              <SampleRow key={s.id} s={s} selected={i === pick} onPick={() => setPick(i)} />
            ))}
            {samples.length === 0 && <p className="text-sm text-muted">{tb("try.none")}</p>}
          </div>
          <div className="min-w-0">
            {sample && walk && walk.blockedBy ? (
              <Notice tone="info">{tb("try.blocked", { name: sample.name, rule: conditionSentence(ts, walk.blockedBy) })}</Notice>
            ) : sample && walk ? (
              <ol className="flex flex-col gap-section">
                <li className="text-sm font-medium text-fg">{tb("try.starts", { day: opts.day(walk.startAt), clock: opts.clock(walk.startAt) })}</li>
                {walk.rows.map((r, i) => (
                  <Row key={`${r.stepId}-${i}`} row={r} venue={venue} />
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}
