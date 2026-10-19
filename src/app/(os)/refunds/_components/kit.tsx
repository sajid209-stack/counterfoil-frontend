"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AffixInput, Button, Field, FormField, Modal, StatusPill } from "@/components/ui";
import { getStaff } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { DEMO_STAFF_ID } from "@/lib/session";

/**
 * Pieces the Refunds and Write-offs screens share.
 *
 * The two screens are one idea drawn twice — a request from the counter, with a
 * respond-by time, waiting for a manager to answer — so the words for time, the
 * "who is answering" lookup, the answer-with-a-reason dialog and the detail
 * layout live here once. They differ only in what is being given back.
 */

/** The signed-in staff member's name, for "decided by". The Manager word until
 *  the name has arrived. */
export function useWho(): string {
  const t = useTranslations("requests");
  const q = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  return q.data?.name ?? t("manager");
}

/** The clock, ticking each minute, so "Due in 3 h" does not go stale on a page
 *  left open. Only called in components that draw after the browser has taken
 *  over, so the server never prints a time. */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** A length of time in the short form a list wants: "20 min", "3 h", "2 d". */
export function useSpan() {
  const t = useTranslations("requests");
  return (ms: number): string => {
    const min = Math.max(1, Math.round(Math.abs(ms) / 60000));
    if (min < 60) return t("span.min", { n: min });
    const hr = Math.round(min / 60);
    if (hr < 48) return t("span.hr", { n: hr });
    return t("span.day", { n: Math.round(hr / 24) });
  };
}

/** "3 h ago", or "Just now" inside the first minute. */
export function useAgo() {
  const t = useTranslations("requests");
  const span = useSpan();
  return (iso: string, now: number): string => {
    const ms = now - Date.parse(iso);
    return ms < 60_000 ? t("justNow") : t("ago", { span: span(ms) });
  };
}

/**
 * The respond-by chip: "Due in 3 h" in neutral, "Overdue" in the danger wash.
 * Drawn only on rows that are waiting — once answered, the deadline is history.
 */
export function RespondChip({ dueAt, now }: { dueAt: string; now: number }) {
  const t = useTranslations("requests");
  const span = useSpan();
  const left = Date.parse(dueAt) - now;
  return left < 0 ? (
    <StatusPill tone="danger">{t("overdue")}</StatusPill>
  ) : (
    <StatusPill tone="neutral">{t("dueIn", { span: span(left) })}</StatusPill>
  );
}

/** "1,276.74" or "500" → minor units; NaN for anything that is not an amount. */
export const parseTaka = (text: string): number => {
  const s = text.replace(/,/g, "").trim();
  return /^\d+(\.\d{1,2})?$|^\.\d{1,2}$/.test(s) ? Math.round(parseFloat(s) * 100) : NaN;
};
export const takaText = (minor: number): string => (minor / 100).toFixed(2);

/**
 * A dialog that asks one question — "Why not?" — and will not take an empty
 * answer. Declining a refund and rejecting a write-off are both this.
 *
 * Mount it only while it is wanted (`{declining && <ReasonDialog … />}`), so the
 * text and the error start fresh each time instead of remembering the last one.
 * `onSubmit` returns an error message to show under the field, or nothing when it
 * worked (the caller then closes it).
 */
export function ReasonDialog({
  title,
  label,
  placeholder,
  help,
  required,
  confirm,
  onClose,
  onSubmit,
}: {
  title: string;
  label: string;
  placeholder: string;
  help: string;
  required: string;
  confirm: string;
  onClose: () => void;
  onSubmit: (note: string) => Promise<string | void>;
}) {
  const t = useTranslations("requests");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const id = "request-reason-note";

  useEffect(() => {
    const f = requestAnimationFrame(() => document.getElementById(id)?.focus());
    return () => cancelAnimationFrame(f);
  }, []);

  const submit = async () => {
    if (!note.trim()) {
      setError(required);
      document.getElementById(id)?.focus();
      return;
    }
    setBusy(true);
    const problem = await onSubmit(note.trim());
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" onClick={() => void submit()} loading={busy}>
            {confirm}
          </Button>
        </>
      }
    >
      <FormField
        id={id}
        variant="textarea"
        label={label}
        placeholder={placeholder}
        help={help}
        error={error}
        rows={3}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setError(undefined);
        }}
      />
    </Modal>
  );
}

/** A label over a value — one fact in a detail. */
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-inline break-words text-base text-fg">{children}</dd>
    </div>
  );
}

/** A titled group inside a detail, set off by a hairline rather than a box. */
export function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-comfortable border-t border-hairline px-card py-section first:border-t-0">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

export interface TimelineItem {
  id: string;
  label: string;
  when: string;
  note?: string | null;
}

/** What happened, oldest first: asked, then decided. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col gap-comfortable">
      {items.map((i) => (
        <li key={i.id} className="flex gap-comfortable">
          <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-strong" />
          <div className="min-w-0">
            <p className="text-base text-fg">{i.label}</p>
            <p className="text-sm text-muted">{i.when}</p>
            {i.note ? <p className="mt-inline break-words text-sm text-fg-secondary">“{i.note}”</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A money field: the ৳ sits inside it, the figure is large, and a refusal is
 *  said in words underneath and tied to the field for a screen reader. */
export function AmountField({
  id,
  label,
  help,
  error,
  value,
  onChange,
}: {
  id: string;
  label: string;
  help?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} help={help} error={error} htmlFor={id}>
      <AffixInput
        id={id}
        data-autofocus
        inputMode="decimal"
        autoComplete="off"
        prefix="৳"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={!!error}
        aria-describedby={error || help ? `${id}-msg` : undefined}
        inputClassName="text-xl! font-semibold tabular-nums"
      />
    </Field>
  );
}
