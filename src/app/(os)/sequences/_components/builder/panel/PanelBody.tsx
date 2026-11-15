"use client";

import { ArrowDown, ArrowUp, CircleCheck, Trash2 } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import {
  canMove,
  elapsedByStep,
  findStep,
  moveStep,
  removeStep,
  sequenceSentence,
  spanWords,
  countSteps,
  type SequenceStep,
} from "@/lib/sequences";
import { StartTile, StepTile } from "../../kinds";
import { useBuilder } from "../context";
import { MessagePanel } from "./MessagePanel";
import { StartPanel } from "./StartPanel";
import { AppPanel, BranchPanel, OfferPanel, WaitPanel } from "./StepPanels";

function Summary() {
  const { form, problems, ts, tb, select, focusName, isNew } = useBuilder();
  const steps = countSteps(form.steps);
  const total = Math.max(0, ...Object.values(elapsedByStep(form.steps)));
  const go = (where: string) => (where === "name" ? focusName() : select(where === "start" ? "start" : where));
  return (
    <div className="flex flex-col gap-section">
      <p className="text-base text-fg">{sequenceSentence(ts, form)}</p>
      <p className="text-sm text-muted">
        {tb("summary.steps", { count: steps })}
        {total > 0 && ` · ${tb("summary.takes", { span: spanWords(ts, total) })}`}
      </p>
      <section aria-labelledby="seq-finish" className="flex flex-col gap-tight">
        <h3 id="seq-finish" className="text-sm font-medium text-muted">
          {tb("summary.toFinish")}
        </h3>
        {problems.length === 0 ? (
          <p className="flex items-center gap-tight text-sm text-success">
            <CircleCheck size={16} strokeWidth={1.5} aria-hidden />
            {tb("summary.ready")}
          </p>
        ) : (
          <ul className="flex flex-col">
            {problems.map((p, i) => (
              <li key={`${p.where}-${p.code}-${i}`}>
                <button
                  type="button"
                  onClick={() => go(p.where)}
                  className="flex min-h-11 w-full items-center gap-tight rounded-control px-tight text-left text-sm text-fg transition-colors duration-quick ease-counterfoil hover:bg-muted-wash motion-reduce:transition-none md:min-h-9"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-full bg-danger" />
                  {ts(`problem.${p.code}`)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {isNew && <p className="text-sm text-muted">{tb("summary.tip")}</p>}
    </div>
  );
}

function StepBody({ step }: { step: SequenceStep }) {
  switch (step.kind) {
    case "wait":
      return <WaitPanel step={step} />;
    case "offer":
      return <OfferPanel step={step} />;
    case "app":
      return <AppPanel step={step} />;
    case "branch":
      return <BranchPanel step={step} />;
    default:
      return <MessagePanel step={step} />;
  }
}

/** What the panel shows for the selected card. One component for the side panel and the phone sheet. */
export function PanelBody({ inSheet = false }: { inSheet?: boolean }) {
  const { form, selected, select, change, ts, tb } = useBuilder();
  const toast = useToast();
  const placed = selected && selected !== "start" ? findStep(form.steps, selected) : null;
  const step = placed?.step ?? null;

  const remove = () => {
    if (!step) return;
    const before = form.steps;
    change({ steps: removeStep(before, step.id) });
    select(null);
    toast.success(tb("panel.removed"), { run: () => change({ steps: before }) });
  };

  const title = selected === "start" ? ts("start.label") : step ? ts(`step.${step.kind}.name`) : tb("summary.title");

  return (
    <div className="flex flex-col gap-section p-card">
      <div className="flex items-center gap-comfortable">
        {selected === "start" ? <StartTile kind={form.start.kind} size="sm" /> : step ? <StepTile kind={step.kind} size="sm" /> : null}
        {inSheet ? <span className="flex-1" /> : <h2 className="min-w-0 flex-1 break-words text-md font-semibold text-fg">{title}</h2>}
        {step && (
          <div className="flex shrink-0 items-center gap-inline">
            <Button size="icon" variant="tertiary" aria-label={tb("panel.up")} disabled={!canMove(form.steps, step.id, -1)} onClick={() => change({ steps: moveStep(form.steps, step.id, -1) })} icon={<ArrowUp size={16} strokeWidth={1.5} aria-hidden />} />
            <Button size="icon" variant="tertiary" aria-label={tb("panel.down")} disabled={!canMove(form.steps, step.id, 1)} onClick={() => change({ steps: moveStep(form.steps, step.id, 1) })} icon={<ArrowDown size={16} strokeWidth={1.5} aria-hidden />} />
            <Button size="icon" variant="destructive" aria-label={tb("panel.delete")} onClick={remove} icon={<Trash2 size={16} strokeWidth={1.5} aria-hidden />} />
          </div>
        )}
      </div>
      {selected === "start" ? <StartPanel /> : step ? <StepBody key={step.id} step={step} /> : <Summary />}
    </div>
  );
}
