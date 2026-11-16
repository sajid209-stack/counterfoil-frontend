"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui";
import { MAX_STEPS, START_KINDS, START_META, stepKindsFor, type SequenceStep, type StepKind } from "@/lib/sequences";
import { blankStep, insertStep } from "@/lib/sequences";
import { StartTile, StepTile } from "../../kinds";
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

/** The steps most sequences are made of. The rest sit behind "More steps". */
const COMMON: StepKind[] = ["text", "email", "wait", "team", "branch", "offer"];

/** The kinds of step, as buttons — the common ones, then the rest behind one
 *  "More steps" row. Used by the add menu and the empty flow. */
export function StepKinds({ kinds, onPick, className }: { kinds: StepKind[]; onPick: (k: StepKind) => void; className?: string }) {
  const { tb } = useBuilder();
  const [more, setMore] = useState(false);
  const common = kinds.filter((k) => COMMON.includes(k));
  const rest = kinds.filter((k) => !COMMON.includes(k));
  return (
    <div className={className}>
      <StepKindList kinds={more ? kinds : common} onPick={onPick} />
      {!more && rest.length > 0 && (
        <button
          type="button"
          onClick={() => setMore(true)}
          className="mt-inline flex min-h-11 w-full items-center gap-tight rounded-control px-comfortable text-sm font-medium text-fg-secondary transition-colors duration-quick ease-counterfoil hover:bg-muted-wash hover:text-fg motion-reduce:transition-none md:min-h-9"
        >
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden />
          {tb("flow.moreSteps")}
        </button>
      )}
    </div>
  );
}

/** "When should it start?" — the first and only question a new sequence asks
 *  before its steps. Plain answers, grouped by who they are about. */
function StartChooser() {
  const { ts, tb, pickStart } = useBuilder();
  const groups = (["customer", "team"] as const).map((about) => ({ about, kinds: START_KINDS.filter((k) => START_META[k].about === about) }));
  return (
    <section aria-labelledby="seq-choose" className="card-surface p-card">
      <h2 id="seq-choose" className="text-md font-semibold text-fg">
        {tb("choose.title")}
      </h2>
      <p className="mt-inline text-sm text-muted">{tb("choose.body")}</p>
      {groups.map((g) => (
        <div key={g.about} className="mt-section">
          <p className="px-comfortable text-xs font-medium text-muted">{ts(`start.group.${g.about}`)}</p>
          <ul className="mt-inline flex flex-col">
            {g.kinds.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => pickStart(k)}
                  className="flex min-h-11 w-full items-center gap-comfortable rounded-control p-comfortable text-left transition-colors duration-quick ease-counterfoil hover:bg-muted-wash motion-reduce:transition-none"
                >
                  <StartTile kind={k} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-medium text-fg">{ts(`start.${k}.name`)}</span>
                    <span className="block text-sm text-muted">{ts(`start.${k}.hint`)}</span>
                  </span>
                  <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** The kinds of step, as buttons. */
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
  const { form, tb, canAdd, change, select, choosing } = useBuilder();
  const first = (k: ReturnType<typeof stepKindsFor>[number]) => {
    const step = blankStep(k);
    change({ steps: insertStep(form.steps, { parentId: null, side: null, index: 0 }, step) });
    select(step.id);
  };
  if (choosing) return <StartChooser />;
  return (
    <div className="flex flex-col">
      <StartCard />
      <RulesStrip />
      {form.steps.length === 0 ? (
        <>
          <Connector inset="root" />
          <div className="rounded-card border border-dashed border-line p-card">
            <p className="px-comfortable text-base font-medium text-fg">{tb("flow.addFirst")}</p>
            <StepKinds kinds={stepKindsFor(form.start)} onPick={first} className="mt-tight" />
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
