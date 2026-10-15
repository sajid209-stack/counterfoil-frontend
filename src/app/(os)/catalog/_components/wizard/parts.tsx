"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Circle, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

/** The steps of the add wizard. Only the ones that apply to the item in hand
 *  are ever drawn. */
export type StepKey = "name" | "when" | "price" | "where" | "page" | "review";

/** One line of the ready-to-sell list. */
export interface ReadyCheck {
  key: string;
  label: string;
  done: boolean;
  /** The step that fixes it. */
  step: StepKey;
  /** Why it is not done, where that can be said in a few words. */
  hint?: string;
}

/**
 * Ready to sell: the same blockers the catalog flags, ticked off as they are
 * met, each one a way back to the step that fixes it. Nothing is ticked on the
 * operator's behalf.
 */
export function Checklist({
  checks,
  reachable,
  onGo,
  ready,
  noPage = false,
  bare = false,
}: {
  checks: ReadyCheck[];
  reachable: (step: StepKey) => boolean;
  onGo: (step: StepKey) => void;
  ready: boolean;
  /** Not sold online, so there is no page to finish — said, not just left out. */
  noPage?: boolean;
  /** Folded out above the phone bar, which already says "What's left". */
  bare?: boolean;
}) {
  const t = useTranslations("catalog.wizard");
  const ta = useTranslations("catalog.addFlow");
  return (
    <div>
      {!bare && <p className="mb-tight text-sm font-medium text-muted">{t("readyTitle")}</p>}
      <ul className="flex flex-col gap-0.5">
        {checks.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              disabled={!reachable(c.step)}
              onClick={() => onGo(c.step)}
              className="flex min-h-11 w-full items-start gap-tight rounded-control px-inline py-tight text-left text-sm transition-colors duration-quick enabled:hover:bg-muted-wash md:min-h-9"
            >
              {c.done ? (
                <Check size={16} strokeWidth={2} aria-hidden className="mt-px shrink-0 text-success" />
              ) : (
                <Circle size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-muted" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className={cn(!c.done && "text-muted")}>{c.label}</span>
                {c.hint && <span className="text-xs text-warning">{c.hint}</span>}
              </span>
              <span className="sr-only">{c.done ? t("checkDone") : t("checkTodo")}</span>
            </button>
          </li>
        ))}
        {noPage && (
          <li className="px-inline py-tight text-sm text-muted">{ta("rail.noPage")}</li>
        )}
      </ul>
      <p className={cn("mt-tight text-sm font-medium", ready ? "text-success" : "text-muted")}>
        {ready ? t("readyYes") : t("readyNo", { count: checks.filter((c) => !c.done).length })}
      </p>
    </div>
  );
}

/** A row of the final check: what it is, what was answered, and the way back to change it. */
export function ReviewRow({
  label,
  onEdit,
  editLabel,
  editText,
  children,
}: {
  label: string;
  onEdit?: () => void;
  editLabel?: string;
  editText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-section gap-y-inline border-t border-hairline py-comfortable text-base sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <span className="col-span-2 text-sm font-medium text-muted sm:col-span-1">{label}</span>
      <span className="min-w-0">{children}</span>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="-my-tight flex h-11 items-center gap-inline self-start rounded-control px-tight text-sm font-medium text-brand-foreground hover:bg-muted-wash sm:h-9"
        >
          <Pencil size={13} strokeWidth={1.5} aria-hidden />
          <span className="max-sm:sr-only">{editText}</span>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

/** Something the answer still lacks, said in place. */
export function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-inline text-warning">
      <AlertTriangle size={13} strokeWidth={2} aria-hidden />
      {children}
    </span>
  );
}

/** A channel, on or off, in the final check. */
export function ChannelLine({ on, label }: { on: boolean; label: string }) {
  const t = useTranslations("catalog.wizard");
  return (
    <span className={cn("inline-flex items-center gap-inline", !on && "text-muted")}>
      {on ? <Check size={14} strokeWidth={2} aria-hidden className="text-success" /> : <Circle size={14} strokeWidth={1.5} aria-hidden />}
      {on ? label : t("channelOff", { name: label })}
    </span>
  );
}
