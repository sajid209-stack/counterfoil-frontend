"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { Clock, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { peekProducts } from "@/lib/api";
import {
  START_META,
  conditionSentence,
  elapsedByStep,
  problemsAt,
  spanWords,
  startSentence,
  stepTitle,
  whichBookings,
  type BranchStep,
  type ProblemCode,
  type SequenceStep,
} from "@/lib/sequences";
import { StartTile, StepTile } from "../../kinds";
import { useBuilder } from "../context";
import { Words } from "../Words";
import { INSET_PAD, spineLine } from "./Spine";

const SELECTED = "outline outline-2 outline-ember";

/** A card that is a button: Enter and Space select it. A div, because a card holds blocks. */
export function PressCard({
  selected,
  onPress,
  label,
  className,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPress();
    }
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      onClick={onPress}
      onKeyDown={onKey}
      className={cn("relative cursor-pointer text-left transition-shadow duration-quick ease-counterfoil motion-reduce:transition-none", selected && SELECTED, className)}
    >
      {children}
    </div>
  );
}

function ProblemDot() {
  return <span aria-hidden className="absolute right-tight top-tight size-2 rounded-full bg-danger" />;
}

function Problem({ code }: { code: ProblemCode }) {
  const { ts } = useBuilder();
  return <p className="text-sm text-danger">{ts(`problem.${code}`)}</p>;
}

export function StartCard() {
  const { form, ts, tb, selected, select } = useBuilder();
  const which = whichBookings(ts, form.start, (id) => peekProducts().find((p) => p.id === id)?.name);
  const sentence = startSentence(ts, form.start);
  return (
    <PressCard selected={selected === "start"} onPress={() => select("start")} label={`${tb("flow.startsWhen")}: ${sentence}`} className="card-surface w-full p-card">
      <p className="text-xs font-medium text-muted">{tb("flow.startsWhen")}</p>
      <div className="mt-tight flex items-center gap-comfortable">
        <StartTile kind={form.start.kind} />
        <div className="min-w-0">
          <p className="break-words text-base font-semibold text-fg">{sentence}</p>
          {START_META[form.start.kind].bookings && <p className="text-sm text-muted">{which}</p>}
        </div>
      </div>
    </PressCard>
  );
}

/** "Only if" lines and stop rules, quiet, on the spine. Pressing one opens the start card's panel. */
export function RulesStrip() {
  const { form, ts, tb, select } = useBuilder();
  const customer = START_META[form.start.kind].about === "customer";
  const lines: { key: string; text: string; moon?: boolean }[] = [
    ...form.onlyIf.map((c) => ({ key: c.id, text: conditionSentence(ts, c) })),
    ...(customer ? form.stopIf.map((r) => ({ key: `stop-${r}`, text: ts(`stop.${r}.sentence`) })) : []),
    ...(customer && form.quietHours ? [{ key: "quiet", text: tb("flow.quiet"), moon: true }] : []),
  ];
  if (!lines.length) return null;
  return (
    <div>
      {lines.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => select("start")}
          className={cn("relative flex min-h-11 w-full items-center gap-tight py-inline text-left text-sm text-fg-secondary hover:text-fg md:min-h-7", INSET_PAD.root)}
        >
          <span aria-hidden className={spineLine("root", "inset-y-0")} />
          <span aria-hidden className="absolute left-8 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-strong" />
          {l.moon && <Moon size={14} strokeWidth={1.5} aria-hidden className="shrink-0" />}
          <span className="min-w-0 break-words">{l.text}</span>
        </button>
      ))}
    </div>
  );
}

export function StepCard({ step, lane = false }: { step: Exclude<SequenceStep, { kind: "wait" } | { kind: "branch" }>; lane?: boolean }) {
  const { form, ts, tb, problems, selected, select, numbers } = useBuilder();
  const probs = problemsAt(problems, step.id);
  const after = elapsedByStep(form.steps)[step.id] ?? 0;
  const title = stepTitle(ts, step);
  const n = numbers[step.id];
  return (
    <PressCard
      selected={selected === step.id}
      onPress={() => select(step.id)}
      label={`${n ? tb("flow.stepNumber", { n }) + ": " : ""}${title}`}
      className={cn("card-surface w-full py-comfortable pr-section", lane ? "pl-comfortable" : "pl-5")}
    >
      {probs.length > 0 && <ProblemDot />}
      <div className="flex items-center gap-comfortable">
        {n && (
          <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-subtle text-xs font-medium text-fg-secondary">
            {n}
          </span>
        )}
        <StepTile kind={step.kind} size="sm" />
        <p className="min-w-0 flex-1 break-words text-base font-medium text-fg">{title}</p>
        {after > 0 && !lane && <span className="hidden shrink-0 text-xs text-muted sm:inline">{tb("flow.after", { span: spanWords(ts, after) })}</span>}
      </div>
      <div className={cn("mt-tight", !lane && "pl-9")}>
        {probs.length > 0 ? (
          <Problem code={probs[0]} />
        ) : step.kind === "email" ? (
          <>
            <p className="line-clamp-1 break-words text-sm font-medium text-fg">{step.subject}</p>
            <Words body={step.body} clamp />
          </>
        ) : step.kind === "app" ? (
          <p className="break-all font-mono text-sm text-fg-secondary">{step.url}</p>
        ) : step.kind === "offer" ? (
          <p className="text-sm text-muted">{ts("step.offer.hint")}</p>
        ) : (
          <Words body={step.body} clamp />
        )}
      </div>
    </PressCard>
  );
}

export function WaitCard({ step, lane = false }: { step: Extract<SequenceStep, { kind: "wait" }>; lane?: boolean }) {
  const { ts, problems, selected, select } = useBuilder();
  const probs = problemsAt(problems, step.id);
  return (
    <div className={cn("flex flex-wrap items-center gap-tight", !lane && "pl-4")}>
      <PressCard
        selected={selected === step.id}
        onPress={() => select(step.id)}
        label={stepTitle(ts, step)}
        className={cn("flex h-9 w-auto items-center gap-tight rounded-full border bg-card px-comfortable text-sm text-fg", probs.length ? "border-danger" : "border-line")}
      >
        <Clock size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
        {stepTitle(ts, step)}
      </PressCard>
      {probs.length > 0 && <Problem code={probs[0]} />}
    </div>
  );
}

/** The "if" itself: its question, selectable. The two sides are drawn by the flow. */
export function BranchHeader({ step }: { step: BranchStep }) {
  const { ts, problems, selected, select } = useBuilder();
  const probs = problemsAt(problems, step.id);
  const q = conditionSentence(ts, step.condition, "iff");
  return (
    <PressCard selected={selected === step.id} onPress={() => select(step.id)} label={q} className="w-full rounded-control border border-line bg-card p-comfortable">
      {probs.length > 0 && <ProblemDot />}
      <div className="flex items-center gap-comfortable">
        <StepTile kind="branch" size="sm" />
        <p className="min-w-0 break-words text-base font-medium text-fg">{q}</p>
      </div>
      {probs.length > 0 && (
        <div className="mt-tight pl-10">
          <Problem code={probs[0]} />
        </div>
      )}
    </PressCard>
  );
}

export function LanePill({ side }: { side: "yes" | "no" }) {
  const { ts } = useBuilder();
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-comfortable text-xs font-medium", side === "yes" ? "bg-success-wash text-success" : "border border-line bg-card text-fg-secondary")}>
      {ts(`step.branch.${side}`)}
    </span>
  );
}
