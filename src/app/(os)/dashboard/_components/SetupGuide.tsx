"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2, Check, ChevronDown, CreditCard, Info, MapPin, Minus, PartyPopper, Store, TabletSmartphone, Ticket, Users, type LucideIcon } from "lucide-react";
import { ActionMenu, Button, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SetupSide } from "./SetupSide";
import type { useSetupGuideState } from "./setupStore";

/** The seven steps, in the order that unlocks money: where, what, how paid, then who and on what. */
export const SETUP_STEPS = ["business", "venue", "catalog", "payments", "counter", "team", "device"] as const;
export type SetupStepKey = (typeof SETUP_STEPS)[number];

const ICON: Record<SetupStepKey, LucideIcon> = {
  business: Building2,
  venue: MapPin,
  catalog: Ticket,
  payments: CreditCard,
  counter: Store,
  team: Users,
  device: TabletSmartphone,
};
const HREF: Record<SetupStepKey, string> = {
  business: "/settings/business",
  venue: "/settings/locations/new",
  catalog: "/catalog/new",
  payments: "/settings/payments",
  counter: "/settings/counters/new",
  team: "/settings/team/new",
  device: "/settings/devices/new",
};
/** A step that cannot be done until another is: the step it waits for. */
const NEEDS: Partial<Record<SetupStepKey, SetupStepKey>> = { counter: "venue", device: "counter" };

type Guide = ReturnType<typeof useSetupGuideState>;

/**
 * A new account's whole dashboard: a welcome, the setup guide and a side column.
 * Steps tick themselves from the business's real records (`done`); the person can
 * only skip a step, never tick one. One step is open at a time - the first one
 * not finished, unless another row was chosen.
 */
export function SetupGuide({
  done,
  business,
  firstName,
  guide,
}: {
  /** Whether each step's records exist. Ticks come from data, never from clicks. */
  done: Record<SetupStepKey, boolean>;
  business: string;
  firstName: string;
  guide: Guide;
}) {
  const t = useTranslations("dashboard.setup");
  const [chosen, setChosen] = useState<SetupStepKey | "none" | undefined>(undefined);
  const baseId = useId();

  const skipped = (k: SetupStepKey) => !done[k] && guide.skipped.includes(k);
  const finished = (k: SetupStepKey) => done[k] || skipped(k);
  const doneCount = SETUP_STEPS.filter((k) => done[k]).length;
  const skippedCount = SETUP_STEPS.filter(skipped).length;
  const allFinished = SETUP_STEPS.every(finished);
  const firstOpen = SETUP_STEPS.find((k) => !finished(k));
  const openKey = chosen === "none" ? undefined : (chosen ?? firstOpen);

  const heading = firstName ? t("welcome", { name: firstName }) : t("welcomeNoName");
  const lead = business ? t("lead", { business }) : t("leadNoBusiness");

  return (
    <div data-setup-mode className="flex flex-col gap-major">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-title">{heading}</h2>
        <p className="mt-inline break-words text-base text-muted">{lead}</p>
      </div>

      <div className="grid items-start gap-section lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-section lg:col-span-2">
          {allFinished ? (
            <ReadyCard skipped={skippedCount} onDashboard={() => guide.setMode("hidden")} />
          ) : (
            <section aria-labelledby={`${baseId}-title`} className="card-surface overflow-hidden">
              <div className="flex items-start justify-between gap-section px-card pt-card">
                <div className="min-w-0">
                  <h3 id={`${baseId}-title`} className="text-md font-semibold">{t("guideTitle")}</h3>
                  <p className="mt-inline text-sm text-muted">{t("guideLead")}</p>
                </div>
                <div className="-mt-1 -mr-2 shrink-0">
                  <ActionMenu
                    label={t("menu")}
                    items={[{ key: "hide", label: t("hide"), onSelect: () => guide.setMode("hidden") }]}
                  />
                </div>
              </div>

              <div className="px-card pb-section pt-section">
                <div className="mb-tight flex items-center justify-between gap-section text-sm">
                  <span className="font-medium">{t("progress", { done: doneCount, total: SETUP_STEPS.length })}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={t("guideTitle")}
                  aria-valuemin={0}
                  aria-valuemax={SETUP_STEPS.length}
                  aria-valuenow={doneCount}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-line"
                >
                  <div className="h-full rounded-full bg-ember-solid transition-[width] duration-standard ease-counterfoil" style={{ width: `${(doneCount / SETUP_STEPS.length) * 100}%` }} />
                </div>
              </div>

              <ol className="flex flex-col">
                {SETUP_STEPS.map((key, i) => {
                  const open = openKey === key;
                  const need = NEEDS[key];
                  const blockedBy = need && !done[need] ? need : undefined;
                  return (
                    <StepRow
                      key={key}
                      id={`${baseId}-${key}`}
                      stepKey={key}
                      n={i + 1}
                      open={open}
                      done={done[key]}
                      skipped={skipped(key)}
                      blockedBy={blockedBy}
                      onToggle={() => setChosen(open ? "none" : key)}
                      onOpenStep={(k) => setChosen(k)}
                      onSkip={() => { guide.skip(key); setChosen(undefined); }}
                      onUnskip={() => { guide.unskip(key); setChosen(key); }}
                    />
                  );
                })}
              </ol>
            </section>
          )}
        </div>

        <SetupSide />
      </div>
    </div>
  );
}

function StepRow({
  id,
  stepKey,
  n,
  open,
  done,
  skipped,
  blockedBy,
  onToggle,
  onOpenStep,
  onSkip,
  onUnskip,
}: {
  id: string;
  stepKey: SetupStepKey;
  n: number;
  open: boolean;
  done: boolean;
  skipped: boolean;
  blockedBy?: SetupStepKey;
  onToggle: () => void;
  onOpenStep: (k: SetupStepKey) => void;
  onSkip: () => void;
  onUnskip: () => void;
}) {
  const t = useTranslations("dashboard.setup");
  const Icon = ICON[stepKey];
  const title = t(`step.${stepKey}.title`);
  const body = stepKey === "business" && !done ? t("step.business.bodyTodo") : t(`step.${stepKey}.body`);
  const state = done ? "done" : skipped ? "skipped" : "todo";

  return (
    <li data-setup-step={stepKey} data-state={state} data-open={open ? "true" : "false"} className="border-t border-hairline">
      <h4>
        <button
          type="button"
          id={`${id}-h`}
          aria-expanded={open}
          aria-controls={`${id}-p`}
          onClick={onToggle}
          className="flex min-h-14 w-full items-center gap-comfortable px-card py-comfortable text-left transition-colors duration-quick hover:bg-muted-wash"
        >
          <span
            aria-hidden
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-medium",
              done ? "bg-success-solid text-on-solid" : skipped ? "bg-muted-wash text-muted" : open ? "bg-ember-solid text-on-solid" : "bg-muted-wash text-fg-secondary",
            )}
          >
            {done ? <Check size={15} strokeWidth={2.25} /> : skipped ? <Minus size={15} strokeWidth={2} /> : n}
          </span>
          <span className={cn("min-w-0 flex-1 text-base", open ? "font-semibold" : "font-medium", (done || skipped) && !open && "text-fg-secondary")}>{title}</span>
          {(done || skipped) && <span className="shrink-0 text-sm text-muted">{done ? t("stepDone") : t("stepSkipped")}</span>}
          <ChevronDown size={16} strokeWidth={1.75} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
        </button>
      </h4>

      {open && (
        <div id={`${id}-p`} role="region" aria-labelledby={`${id}-h`} className="px-card pb-card sm:pl-[calc(var(--spacing-card)+28px+var(--spacing-comfortable))]">
          <div className="flex flex-col-reverse gap-section sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 sm:max-w-md">
              <p className="text-sm text-fg-secondary">{body}</p>

              {blockedBy && !done && (
                <p className="mt-comfortable flex items-start gap-tight rounded-control bg-info-wash px-comfortable py-tight text-sm text-info">
                  <Info size={15} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
                  <span>{blockedBy === "venue" ? t("needsVenue") : t("needsCounter")}</span>
                </p>
              )}

              <div className="mt-section flex flex-wrap items-center gap-tight">
                {done ? (
                  <ButtonLink href={HREF[stepKey]} variant="secondary" size="sm">{t(stepKey === "business" ? "step.business.action" : "open")}</ButtonLink>
                ) : blockedBy ? (
                  <Button variant="secondary" size="sm" onClick={() => onOpenStep(blockedBy)}>{blockedBy === "venue" ? t("goVenue") : t("goCounter")}</Button>
                ) : (
                  <ButtonLink href={HREF[stepKey]} variant="primary" size="sm">{t(`step.${stepKey}.action`)}</ButtonLink>
                )}
                {!done && !skipped && (
                  <Button variant="tertiary" size="sm" aria-label={t("skipAria", { step: title })} onClick={onSkip}>{t("skip")}</Button>
                )}
                {skipped && (
                  <Button variant="tertiary" size="sm" onClick={onUnskip}>{t("undoSkip")}</Button>
                )}
              </div>
            </div>

            <span aria-hidden className="hidden h-14 w-14 shrink-0 place-items-center rounded-card bg-ember-wash text-brand-foreground sm:grid sm:h-16 sm:w-16">
              <Icon size={28} strokeWidth={1.5} />
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

function ReadyCard({ skipped, onDashboard }: { skipped: number; onDashboard: () => void }) {
  const t = useTranslations("dashboard.setup");
  return (
    <section data-setup-ready className="card-surface p-card sm:p-major">
      <span aria-hidden className="grid h-14 w-14 place-items-center rounded-full bg-success-wash text-success">
        <PartyPopper size={28} strokeWidth={1.5} />
      </span>
      <h3 className="mt-section text-xl font-semibold tracking-title">{t("readyTitle")}</h3>
      <p className="mt-inline max-w-md text-base text-muted">{skipped > 0 ? t("readyBodySkipped", { count: skipped }) : t("readyBody")}</p>
      <div className="mt-major flex flex-wrap items-center gap-tight">
        <ButtonLink href="/pos" variant="primary" size="md">{t("openCounter")}</ButtonLink>
        <Button variant="secondary" size="md" onClick={onDashboard}>{t("goDashboard")}</Button>
      </div>
    </section>
  );
}
