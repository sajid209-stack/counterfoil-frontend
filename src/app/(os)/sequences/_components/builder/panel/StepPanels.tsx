"use client";

import { Field, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { detailsFor, problemsAt, replaceStep, spanWords, type BranchStep, type SequenceStep } from "@/lib/sequences";
import { useBuilder } from "../context";
import { ConditionRow, Duration } from "./Controls";

type Of<K extends SequenceStep["kind"]> = Extract<SequenceStep, { kind: K }>;

function useSet() {
  const { form, change } = useBuilder();
  return (step: SequenceStep, patch: Record<string, unknown>) => change({ steps: replaceStep(form.steps, step.id, { ...step, ...patch } as SequenceStep) });
}

export function WaitPanel({ step }: { step: Of<"wait"> }) {
  const { ts, tb } = useBuilder();
  const set = useSet();
  return (
    <div className="flex flex-col gap-section">
      <Duration label={tb("wait.label")} value={step.minutes} onChange={(m) => set(step, { minutes: m })} min={15} max={30 * 1440} chips={[15, 60, 120, 1440, 2880, 10080]} />
      <p className="text-sm text-muted">{tb("wait.next", { span: spanWords(ts, step.minutes) })}</p>
    </div>
  );
}

export function OfferPanel({ step }: { step: Of<"offer"> }) {
  const { tb } = useBuilder();
  const set = useSet();
  return (
    <div className="flex flex-col gap-section">
      <Duration label={tb("offer.label")} value={step.holdMinutes} onChange={(m) => set(step, { holdMinutes: m })} min={5} max={1440} step={5} chips={[15, 30, 60, 120, 1440]} />
      <p className="text-sm text-muted">{tb("offer.line")}</p>
    </div>
  );
}

export function AppPanel({ step }: { step: Of<"app"> }) {
  const { form, ts, tb, problems } = useBuilder();
  const set = useSet();
  const bad = step.url.trim() !== "" && problemsAt(problems, step.id).includes("appAddress");
  return (
    <div className="flex flex-col gap-section">
      <Field label={tb("app.address")} htmlFor="seq-url" error={bad ? ts("problem.appAddress") : undefined}>
        <input
          id="seq-url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={step.url}
          onChange={(e) => set(step, { url: e.target.value })}
          aria-invalid={bad || undefined}
          className={cn(controlClass(bad), "font-mono")}
        />
      </Field>
      <p className="text-sm text-muted">{tb("app.line")}</p>
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-fg md:min-h-9">{tb("app.sent")}</summary>
        <div className="flex flex-wrap gap-tight pt-tight">
          {detailsFor(form.start, "app").map((k) => (
            <span key={k} className="rounded-full border border-line bg-subtle px-tight text-xs text-fg">
              {ts(`detail.${k}`)}
            </span>
          ))}
        </div>
      </details>
    </div>
  );
}

export function BranchPanel({ step }: { step: BranchStep }) {
  const { tb } = useBuilder();
  const set = useSet();
  return (
    <div className="flex flex-col gap-section">
      <ConditionRow cond={step.condition} lead="iff" onChange={(c) => set(step, { condition: c })} />
      <p className="text-sm text-muted">{tb("branch.line")}</p>
    </div>
  );
}
