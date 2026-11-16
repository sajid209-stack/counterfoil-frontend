"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button, Checkbox, Field, Notice, SegmentedControl, Select, Switch, controlClass } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listProducts } from "@/lib/api";
import {
  MAX_CONDITIONS,
  START_KINDS,
  START_META,
  STOP_RULES,
  blankCondition,
  blankStart,
  placedSteps,
  stepKindsFor,
  type SequenceStart,
  type SequenceStep,
  type StartKind,
  type StopRule,
} from "@/lib/sequences";
import { useBuilder } from "../context";
import { ConditionRow, Duration } from "./Controls";

/** Drop the steps a start cannot have. Works at both levels. */
function fit(steps: SequenceStep[], start: SequenceStart): SequenceStep[] {
  const top = stepKindsFor(start);
  const inner = stepKindsFor(start, true);
  return steps
    .filter((s) => top.includes(s.kind))
    .map((s) => (s.kind === "branch" ? { ...s, yes: s.yes.filter((y) => inner.includes(y.kind)), no: s.no.filter((n) => inner.includes(n.kind)) } : s));
}

function WhichBookings({ start, onChange }: { start: SequenceStart; onChange: (s: SequenceStart) => void }) {
  const { ts, tb } = useBuilder();
  const q = useApiQuery(() => listProducts({ pageSize: 100 }), []);
  const [some, setSome] = useState(start.productIds.length > 0);
  const toggle = (id: string) => onChange({ ...start, productIds: start.productIds.includes(id) ? start.productIds.filter((x) => x !== id) : [...start.productIds, id] });
  return (
    <div className="flex flex-col gap-tight">
      <span id="seq-which" className="text-sm font-medium text-muted">
        {ts("start.whichBookings")}
      </span>
      <SegmentedControl
        aria-labelledby="seq-which"
        value={some ? "some" : "every"}
        onChange={(v) => {
          setSome(v === "some");
          if (v === "every") onChange({ ...start, productIds: [] });
        }}
        options={[
          { value: "every", label: ts("which.every") },
          { value: "some", label: ts("which.some") },
        ]}
      />
      {some && (
        <div role="group" aria-label={ts("which.choose")} className="max-h-60 overflow-y-auto rounded-control border border-line p-tight">
          {(q.data?.data ?? []).map((p) => (
            <Checkbox key={p.id} label={p.name} checked={start.productIds.includes(p.id)} onChange={() => toggle(p.id)} />
          ))}
          {!q.loading && (q.data?.data.length ?? 0) === 0 && <p className="p-tight text-sm text-muted">{tb("start.noBookings")}</p>}
        </div>
      )}
    </div>
  );
}

export function StartPanel() {
  const { form, change, ts, tb } = useBuilder();
  const start = form.start;
  const meta = START_META[start.kind];
  const customer = meta.about === "customer";
  const [removed, setRemoved] = useState(false);
  // Open by itself when something in it is already set beyond the defaults.
  const [open, setOpen] = useState(form.onlyIf.length > 0);

  const setStart = (next: SequenceStart) => change({ start: next });
  const setKind = (kind: string) => {
    const k = kind as StartKind;
    const next = blankStart(k);
    if (START_META[k].bookings && meta.bookings) next.productIds = start.productIds;
    const steps = fit(form.steps, next);
    setRemoved(placedSteps(steps).length < placedSteps(form.steps).length);
    change({ start: next, steps });
  };
  const toggleStop = (r: StopRule) => change({ stopIf: form.stopIf.includes(r) ? form.stopIf.filter((x) => x !== r) : [...form.stopIf, r] });

  return (
    <div className="flex flex-col gap-major">
      <div className="flex flex-col gap-tight">
        <Field label={ts("start.label")} htmlFor="seq-start">
          <Select
            id="seq-start"
            value={start.kind}
            onChange={setKind}
            options={START_KINDS.map((k) => ({ value: k, label: ts(`start.${k}.name`), note: ts(`start.${k}.hint`), group: ts(`start.group.${START_META[k].about}`) }))}
          />
        </Field>
        {removed && (
          <Notice tone="info" size="sm">
            {tb("start.removed")}
          </Notice>
        )}
      </div>

      {meta.span && (
        <Duration
          label={ts(start.kind === "afterVisit" ? "start.howLongAfter" : "start.howLongBefore")}
          value={start.minutes ?? meta.span.fallback}
          onChange={(m) => setStart({ ...start, minutes: m })}
          min={meta.span.min}
          max={meta.span.max}
          chips={[60, 120, 1440, 2880, 10080]}
        />
      )}
      {meta.days && (
        <Field label={ts("start.afterDays")} htmlFor="seq-days">
          <div className="flex items-center gap-tight">
            <input
              id="seq-days"
              type="number"
              inputMode="numeric"
              min={meta.days.min}
              max={meta.days.max}
              value={start.days ?? meta.days.fallback}
              onChange={(e) => setStart({ ...start, days: Math.round(Number(e.target.value) || 0) })}
              className={`${controlClass()} w-28`}
            />
            <span className="text-sm text-muted">{tb("start.days")}</span>
          </div>
        </Field>
      )}
      {meta.amount && (
        <Field label={ts("start.shortBy")} htmlFor="seq-amount">
          <div className="flex items-center gap-tight">
            <span className="text-sm text-muted">৳</span>
            <input
              id="seq-amount"
              type="number"
              inputMode="decimal"
              min={0}
              value={(start.amount ?? meta.amount.fallback) / 100}
              onChange={(e) => setStart({ ...start, amount: Math.round(Math.max(0, Number(e.target.value) || 0) * 100) })}
              className={`${controlClass()} w-36`}
            />
          </div>
        </Field>
      )}

      {meta.bookings && <WhichBookings start={start} onChange={setStart} />}

      <button
        type="button"
        aria-expanded={open}
        aria-controls="seq-more"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-tight border-t border-hairline pt-section text-left text-sm font-medium text-fg md:min-h-9"
      >
        <span>
          {tb("start.more")}
          <span className="block text-sm font-normal text-muted">{tb("start.moreHint")}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={open ? "rotate-180 text-muted transition-transform duration-quick" : "text-muted transition-transform duration-quick"} />
      </button>

      {open && (
      <div id="seq-more" className="flex flex-col gap-major">
      <section className="flex flex-col gap-comfortable" aria-labelledby="seq-onlyif">
        <h3 id="seq-onlyif" className="text-sm font-medium text-muted">
          {ts("onlyIf.label")}
        </h3>
        {form.onlyIf.length === 0 && <p className="text-sm text-muted">{ts("onlyIf.none")}</p>}
        {form.onlyIf.map((c) => (
          <ConditionRow
            key={c.id}
            cond={c}
            onChange={(next) => change({ onlyIf: form.onlyIf.map((x) => (x.id === c.id ? next : x)) })}
            onRemove={() => change({ onlyIf: form.onlyIf.filter((x) => x.id !== c.id) })}
          />
        ))}
        {form.onlyIf.length < MAX_CONDITIONS && (
          <div>
            <Button variant="tertiary" icon={<Plus size={16} strokeWidth={1.5} aria-hidden />} onClick={() => change({ onlyIf: [...form.onlyIf, blankCondition("people")] })}>
              {ts("onlyIf.add")}
            </Button>
          </div>
        )}
      </section>

      {customer && (
        <section className="flex flex-col gap-tight" aria-labelledby="seq-stops">
          <h3 id="seq-stops" className="text-sm font-medium text-muted">
            {ts("stop.label")}
          </h3>
          {STOP_RULES.map((r) => (
            <Checkbox key={r} label={ts(`stop.${r}.name`)} checked={form.stopIf.includes(r)} onChange={() => toggleStop(r)} />
          ))}
        </section>
      )}

      {customer && <Switch label={ts("quiet.label")} description={ts(form.quietHours ? "quiet.on" : "quiet.off")} checked={form.quietHours} onChange={(v) => change({ quietHours: v })} />}
      </div>
      )}
    </div>
  );
}
