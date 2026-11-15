"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { countSteps, ideaDraft, startSentence, type SequenceIdea, type SeqT } from "@/lib/sequences";
import { StartTile, StepTile } from "../kinds";

/**
 * One ready-made idea: what starts it, what it is for, and a small strip that
 * shows the shape of it (the start, then a tile for every step in order). The
 * whole card is one button, so the target is the card and not a link inside it.
 */
export function IdeaCard({ idea, onChoose, disabled, busy }: { idea: SequenceIdea; onChoose: (id: string) => void; disabled?: boolean; busy?: boolean }) {
  const ts = useTranslations("sequences");
  const t = useTranslations("sequencesList");
  const draft = ideaDraft(ts as unknown as SeqT, idea.id);
  if (!draft) return null;
  const name = ts(`ideas.${idea.id}.name`);
  const steps = draft.steps;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={() => onChoose(idea.id)}
      className={cn(
        "card-surface card-interactive flex h-full w-full flex-col gap-comfortable p-card text-left transition-opacity duration-quick",
        disabled && !busy && "opacity-60",
        busy && "animate-pulse",
      )}
    >
      <span className="flex items-start gap-comfortable">
        <StartTile kind={draft.start.kind} size="md" />
        <span className="flex min-w-0 flex-1 flex-col gap-inline">
          <span className="text-base font-semibold text-fg">{name}</span>
          <span className="text-sm text-muted">{ts(`ideas.${idea.id}.desc`)}</span>
        </span>
      </span>

      <span className="mt-auto flex flex-col gap-tight border-t border-hairline pt-comfortable">
        <span className="flex min-w-0 items-center gap-inline text-xs text-muted">
          <Clock size={12} strokeWidth={1.5} aria-hidden className="shrink-0" />
          <span className="min-w-0 truncate">{startSentence(ts as unknown as SeqT, draft.start)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-tight">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-y-tight">
            {steps.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && <span aria-hidden className="h-px w-3 shrink-0 bg-line" />}
                <StepTile kind={s.kind} size="sm" />
              </Fragment>
            ))}
          </span>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted">{t("new.steps", { count: countSteps(steps) })}</span>
        </span>
      </span>
    </button>
  );
}
