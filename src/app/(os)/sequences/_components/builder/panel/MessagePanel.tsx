"use client";

import { useId, useMemo, useRef } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { Field, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { trySamples } from "@/lib/api";
import { demoNow } from "@/lib/schedule";
import {
  TEAM_AUDIENCES,
  detailsFor,
  needsYes,
  problemsAt,
  replaceStep,
  textParts,
  walkSequence,
  type DetailKey,
  type SequenceStep,
  type TeamAudience,
} from "@/lib/sequences";
import { useBuilder } from "../context";
import { walkOptions } from "../walkOptions";
import { WordsEditor, type WordsEditorHandle } from "../WordsEditor";

type MessageStep = Extract<SequenceStep, { kind: "text" | "email" | "team" | "note" }>;

/** What this step would say for a real booking: the first "Try it" sample, with every detail filled in. */
function useFilled(step: MessageStep) {
  const { form, venue } = useBuilder();
  return useMemo(() => {
    const sample = trySamples(form.start.kind)[0];
    if (!sample) return null;
    const walk = walkSequence({ start: form.start, onlyIf: [], steps: [step], quietHours: false }, sample, demoNow(), walkOptions(venue));
    return walk.rows[0] ? { ...walk.rows[0], name: sample.name } : null;
  }, [form.start, step, venue]);
}

function DetailChips({ details, onInsert }: { details: DetailKey[]; onInsert: (key: DetailKey) => void }) {
  const { ts, tb } = useBuilder();
  return (
    <div className="flex flex-col gap-tight">
      <span className="text-xs font-medium text-muted">{tb("msg.addDetail")}</span>
      <div className="flex flex-wrap gap-tight">
        {details.map((k) => (
          <button
            key={k}
            type="button"
            // Keep the caret in the words: the chip goes where the owner was typing.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsert(k)}
            className="inline-flex min-h-11 items-center gap-inline rounded-full border border-line bg-card px-comfortable text-sm text-fg transition-colors duration-quick ease-counterfoil hover:bg-muted-wash motion-reduce:transition-none md:min-h-8"
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
            {ts(`detail.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Consent({ kind }: { kind: "text" | "email" }) {
  const { form, ts } = useBuilder();
  return (
    <p className="flex items-start gap-tight text-sm text-muted">
      <ShieldCheck size={14} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
      {ts(`whoGets.${kind}.${needsYes(form.start) ? "yes" : "service"}`)}
    </p>
  );
}

export function MessagePanel({ step }: { step: MessageStep }) {
  const { form, change, ts, tb, venue, problems } = useBuilder();
  const bodyRef = useRef<WordsEditorHandle>(null);
  const subjectRef = useRef<WordsEditorHandle>(null);
  const last = useRef<"subject" | "body">("body");
  const ids = useId();
  const filled = useFilled(step);
  const details = detailsFor(form.start, step.kind);
  const email = step.kind === "email";
  const probs = problemsAt(problems, step.id);
  const label = (k: DetailKey) => ts(`detail.${k}`);

  const set = (patch: Record<string, unknown>) => change({ steps: replaceStep(form.steps, step.id, { ...step, ...patch } as SequenceStep) });
  const insert = (key: DetailKey) => (email && last.current === "subject" ? subjectRef : bodyRef).current?.insert(key);

  const words = filled?.words ?? step.body;
  const parts = step.kind === "text" ? textParts(words) : null;
  // Bangla letters and the ৳ sign make a text hold 70 letters, not 160.
  const short = !!parts && parts.perPart <= 70;

  return (
    <div className="flex flex-col gap-major">
      {step.kind === "text" || step.kind === "email" ? (
        <p className="text-sm text-fg-secondary">
          <span className="font-medium text-muted">{tb("msg.who")}</span>
          <br />
          {tb("msg.whoCustomer")}
        </p>
      ) : step.kind === "team" ? (
        <Field label={tb("msg.who")} htmlFor="seq-audience">
          <Select
            id="seq-audience"
            value={step.to}
            onChange={(v) => set({ to: v as TeamAudience })}
            options={TEAM_AUDIENCES.map((a) => ({ value: a, label: tb(`audience.${a}`) }))}
          />
        </Field>
      ) : null}

      {email && (
        <div className="flex flex-col gap-inline">
          <span id={`${ids}-subject`} className="text-sm font-medium text-fg">
            {tb("msg.subject")}
          </span>
          <WordsEditor
            // A different step is a different box: do not carry one step's caret into the next.
            key={`${step.id}-subject`}
            ref={subjectRef}
            aria-labelledby={`${ids}-subject`}
            multiline={false}
            value={step.subject}
            label={label}
            invalid={probs.includes("emailSubject") && step.subject.trim() !== ""}
            onFocus={() => (last.current = "subject")}
            onChange={(subject) => set({ subject })}
          />
        </div>
      )}

      <div className="flex flex-col gap-tight">
        <span id={`${ids}-words`} className="text-sm font-medium text-fg">
          {email ? tb("msg.emailWords") : tb("msg.words")}
        </span>
        <WordsEditor
          key={step.id}
          ref={bodyRef}
          aria-labelledby={`${ids}-words`}
          tall={email}
          value={step.body}
          label={label}
          placeholder={tb("msg.placeholder")}
          onFocus={() => (last.current = "body")}
          onChange={(body) => set({ body })}
        />
        <DetailChips details={details} onInsert={insert} />
        {parts && parts.chars > 0 && (
          <div className={cn("text-sm", parts.parts >= 2 ? "text-warning" : "text-muted")}>
            <p>{tb("msg.count", { chars: parts.chars, parts: parts.parts })}</p>
            {parts.parts >= 2 && <p>{tb("msg.cost", { parts: parts.parts })}</p>}
            {short && <p className="text-muted">{tb("msg.shorter")}</p>}
          </div>
        )}
      </div>

      {step.kind !== "note" && (
        <div className="flex flex-col gap-tight">
          <span className="text-sm font-medium text-muted">{filled ? tb("msg.previewFor", { name: filled.name }) : tb("msg.preview")}</span>
          {step.kind === "text" && (
            <>
              <p className="text-xs text-muted">{tb("msg.from", { sender: venue || "—" })}</p>
              <p className="max-w-sm whitespace-pre-wrap break-words rounded-card border border-line bg-subtle p-comfortable text-base text-fg">{words || "—"}</p>
            </>
          )}
          {step.kind === "email" && (
            <div className="rounded-card border border-line bg-card p-comfortable">
              <p className="text-xs text-muted">{tb("msg.from", { sender: venue || "—" })}</p>
              <p className="mt-tight break-words text-base font-semibold text-fg">{filled?.subject || "—"}</p>
              <p className="mt-tight whitespace-pre-wrap break-words text-sm text-fg-secondary">{words || "—"}</p>
            </div>
          )}
          {step.kind === "team" && (
            <div className="rounded-card border border-line bg-card p-comfortable">
              <p className="text-xs font-medium text-muted">Counterfoil</p>
              <p className="mt-inline whitespace-pre-wrap break-words text-base text-fg">{words || "—"}</p>
            </div>
          )}
        </div>
      )}

      {(step.kind === "text" || step.kind === "email") && <Consent kind={step.kind} />}
      {step.kind === "team" && <p className="text-sm text-muted">{tb("msg.teamLine")}</p>}
      {step.kind === "note" && <p className="text-sm text-muted">{tb("msg.noteLine")}</p>}
    </div>
  );
}
