"use client";

import { Fragment } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui";
import { MAX_STEPS, stepKindsFor, type SequenceStep } from "@/lib/sequences";
import { blankStep, insertStep } from "@/lib/sequences";
import { StepTile } from "../../kinds";
import { useBuilder } from "../context";
import { BranchHeader, LanePill, RulesStrip, StartCard, StepCard, WaitCard } from "./Cards";
import { Connector, EndMarker, type Inset } from "./Spine";

/** A list of steps with an add button on every connector, at the top level or on one side of an "if". */
function StepList({ steps, parentId, side, inset }: { steps: SequenceStep[]; parentId: string | null; side: "yes" | "no" | null; inset: Inset }) {
  return (
    <>
      {steps.map((s, i) => (
        <Fragment key={s.id}>
          {/* Inside an "if", the first step hangs straight off its Yes / Otherwise
              label: an add button above it as well made each side read as buttons. */}
          <Connector inset={inset} slot={inset === "lane" && i === 0 ? undefined : { parentId, side, index: i }} short={inset === "lane" && i === 0} />
          <StepItem step={s} lane={inset === "lane"} />
        </Fragment>
      ))}
      <Connector inset={inset} slot={{ parentId, side, index: steps.length }} />
    </>
  );
}

function StepItem({ step, lane = false }: { step: SequenceStep; lane?: boolean }) {
  if (step.kind === "wait") return <WaitCard step={step} lane={lane} />;
  if (step.kind === "branch") return <BranchBlock step={step} />;
  return <StepCard step={step} lane={lane} />;
}

function BranchBlock({ step }: { step: Extract<SequenceStep, { kind: "branch" }> }) {
  const { tb, addAt, canAdd } = useBuilder();
  return (
    <div className="rounded-card border border-line bg-subtle p-comfortable">
      <BranchHeader step={step} />
      <div className="mt-comfortable grid gap-section sm:grid-cols-2">
        {(["yes", "no"] as const).map((side) => {
          const list = side === "yes" ? step.yes : step.no;
          return (
            <div key={side} className="min-w-0">
              <LanePill side={side} />
              {list.length === 0 ? (
                <div className="mt-tight flex flex-col gap-tight">
                  <p className="text-sm text-muted">{tb("flow.nothing")}</p>
                  {canAdd && (
                    <button
                      type="button"
                      onClick={() => addAt({ parentId: step.id, side, index: 0 })}
                      className="flex min-h-11 w-full items-center justify-center gap-tight rounded-control border border-dashed border-strong text-sm font-medium text-fg-secondary transition-colors duration-quick ease-counterfoil hover:bg-card hover:text-fg motion-reduce:transition-none md:min-h-9"
                    >
                      <Plus size={14} strokeWidth={1.5} aria-hidden />
                      {tb("flow.addTitle")}
                    </button>
                  )}
                </div>
              ) : (
                <StepList steps={list} parentId={step.id} side={side} inset="lane" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The kinds of step, as buttons. Used by the add menu and the empty flow. */
export function StepKindList({ kinds, onPick, className }: { kinds: ReturnType<typeof stepKindsFor>; onPick: (k: ReturnType<typeof stepKindsFor>[number]) => void; className?: string }) {
  const { ts } = useBuilder();
  return (
    <ul className={cn("flex flex-col", className)}>
      {kinds.map((k) => (
        <li key={k}>
          <button
            type="button"
            onClick={() => onPick(k)}
            className="flex min-h-11 w-full items-center gap-comfortable rounded-control p-comfortable text-left transition-colors duration-quick ease-counterfoil hover:bg-muted-wash motion-reduce:transition-none"
          >
            <StepTile kind={k} size="sm" />
            <span className="min-w-0">
              <span className="block text-base font-medium text-fg">{ts(`step.${k}.name`)}</span>
              <span className="block text-sm text-muted">{ts(`step.${k}.hint`)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Flow() {
  const { form, tb, canAdd, change, select } = useBuilder();
  const first = (k: ReturnType<typeof stepKindsFor>[number]) => {
    const step = blankStep(k);
    change({ steps: insertStep(form.steps, { parentId: null, side: null, index: 0 }, step) });
    select(step.id);
  };
  return (
    <div className="flex flex-col">
      <StartCard />
      <RulesStrip />
      {form.steps.length === 0 ? (
        <>
          <Connector inset="root" />
          <div className="rounded-card border border-dashed border-line p-card">
            <p className="px-comfortable text-base font-medium text-fg">{tb("flow.addFirst")}</p>
            <StepKindList kinds={stepKindsFor(form.start)} onPick={first} className="mt-tight" />
          </div>
        </>
      ) : (
        <>
          <StepList steps={form.steps} parentId={null} side={null} inset="root" />
          <EndMarker />
        </>
      )}
      {!canAdd && <p className="pl-12 pt-tight text-sm text-muted">{tb("flow.max", { count: MAX_STEPS })}</p>}
    </div>
  );
}

/** Three cards on a spine, while the sequence loads. */
export function FlowSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && (
            <div className="relative h-7">
              <span aria-hidden className="absolute left-8 inset-y-0 w-0.5 -translate-x-1/2 bg-line" />
            </div>
          )}
          <div className="card-surface p-card">
            <Skeleton h={12} w={80} />
            <Skeleton h={36} className="mt-tight" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
