"use client";

import { useTranslations } from "next-intl";
import { DurationInput, FormField } from "@/components/ui";
import type { ProductPolicies } from "@/lib/api";
import { useCatalogFormat } from "../../_lib/useCatalogFormat";

/**
 * The rules a booking sells under: how far ahead, when sales stop, whether a
 * customer can cancel or change the date, leave and come back, pay part now,
 * and whether a signed safety form is needed.
 *
 * Every choice is a question with plain answers, and the line under each
 * field says what the value means right now ("Sales stop 15 min before the
 * slot starts.") rather than what the field is called. The summary at the
 * top reuses the answers word for word, so it cannot say something the
 * options below do not.
 */
export function PoliciesField({ value, onChange }: { value: ProductPolicies; onChange: (p: ProductPolicies) => void }) {
  const t = useTranslations("catalog.policies");
  const { dur } = useCatalogFormat();
  const set = <K extends keyof ProductPolicies>(k: K, v: ProductPolicies[K]) => onChange({ ...value, [k]: v });
  const num = (s: string) => parseInt(s, 10) || 0;

  /* The answers, worded once — the options and the summary both read these. */
  const cancelTime = dur(value.cancelHours * 60);
  const rescheduleTime = dur(value.rescheduleHours * 60);
  const cancelAnswer = {
    none: t("cancelNone"),
    free_until: value.cancelHours > 0 ? t("cancelFree", { time: cancelTime }) : t("cancelFreeStart"),
    fee: t("cancelFee"),
  };
  const rescheduleAnswer = {
    none: t("rescheduleNone"),
    until: value.rescheduleHours > 0 ? t("rescheduleUntil", { time: rescheduleTime }) : t("rescheduleUntilStart"),
  };
  const reentryAnswer = { single: t("reentrySingle"), same_day: t("reentrySameDay"), while_valid: t("reentryValid") };
  const reentryHelp = { single: t("reentrySingleHelp"), same_day: t("reentrySameDayHelp"), while_valid: t("reentryValidHelp") };
  const payAnswer = { full: t("payFull"), percent: t("payPart") };

  const summary = [
    t("summaryCancel", { answer: cancelAnswer[value.cancellation] }),
    t("summaryChange", { answer: rescheduleAnswer[value.reschedule] }),
    t("summaryReentry", { answer: reentryAnswer[value.reentry] }),
    t("summaryPay", { answer: payAnswer[value.deposit] }),
    value.waiver ? t("summaryForm") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const cancelHelp =
    value.cancellation === "none"
      ? t("cancelNoneHelp")
      : value.cancellation === "fee"
        ? t("feeHelp", { pct: value.cancelFeePct })
        : undefined;
  const rescheduleHelp = value.reschedule === "none" ? t("rescheduleNoneHelp") : undefined;

  return (
    <div className="flex flex-col gap-major">
      <p className="rounded-sm bg-subtle px-comfortable py-tight text-[13px] text-muted">{summary}</p>

      <Section title={t("section.sell")}>
        <FormField
          label={t("windowDays")}
          variant="number"
          value={String(value.salesWindowDays)}
          onChange={(e) => set("salesWindowDays", num(e.target.value))}
          help={t("windowDaysHelp", { count: value.salesWindowDays })}
        />
        <DurationInput
          label={t("cutoff")}
          value={value.cutoffMinutes}
          onChange={(n) => set("cutoffMinutes", n)}
          chips={[0, 15, 30, 60]}
          help={value.cutoffMinutes > 0 ? t("cutoffHelp", { time: dur(value.cutoffMinutes) }) : t("cutoffHelpNone")}
        />
      </Section>

      <Section title={t("section.change")}>
        <FormField
          label={t("cancelLabel")}
          variant="select"
          value={value.cancellation}
          onChange={(e) => set("cancellation", e.target.value as ProductPolicies["cancellation"])}
          options={[
            { value: "none", label: cancelAnswer.none },
            { value: "free_until", label: cancelAnswer.free_until },
            { value: "fee", label: cancelAnswer.fee },
          ]}
          help={cancelHelp}
        />
        {value.cancellation === "free_until" && (
          <DurationInput
            label={t("cancelUntil")}
            value={value.cancelHours * 60}
            step={60}
            onChange={(n) => set("cancelHours", Math.round(n / 60))}
            chips={[12 * 60, 24 * 60, 48 * 60]}
            help={value.cancelHours > 0 ? t("cancelUntilHelp", { time: cancelTime }) : t("cancelUntilHelpStart")}
          />
        )}
        {value.cancellation === "fee" && (
          <FormField
            label={t("feePct")}
            variant="number"
            placeholder="10"
            value={String(value.cancelFeePct)}
            onChange={(e) => set("cancelFeePct", num(e.target.value))}
          />
        )}
        <FormField
          label={t("rescheduleLabel")}
          variant="select"
          value={value.reschedule}
          onChange={(e) => set("reschedule", e.target.value as ProductPolicies["reschedule"])}
          options={[
            { value: "none", label: rescheduleAnswer.none },
            { value: "until", label: rescheduleAnswer.until },
          ]}
          help={rescheduleHelp}
        />
        {value.reschedule === "until" && (
          <DurationInput
            label={t("rescheduleField")}
            value={value.rescheduleHours * 60}
            step={60}
            onChange={(n) => set("rescheduleHours", Math.round(n / 60))}
            chips={[12 * 60, 24 * 60, 48 * 60]}
            help={value.rescheduleHours > 0 ? t("rescheduleHelp", { time: rescheduleTime }) : t("rescheduleHelpStart")}
          />
        )}
      </Section>

      <Section title={t("section.entry")}>
        <FormField
          label={t("reentryLabel")}
          variant="select"
          value={value.reentry}
          onChange={(e) => set("reentry", e.target.value as ProductPolicies["reentry"])}
          options={[
            { value: "single", label: reentryAnswer.single },
            { value: "same_day", label: reentryAnswer.same_day },
            { value: "while_valid", label: reentryAnswer.while_valid },
          ]}
          help={reentryHelp[value.reentry]}
        />
        <FormField
          label={t("payLabel")}
          variant="select"
          value={value.deposit}
          onChange={(e) => set("deposit", e.target.value as ProductPolicies["deposit"])}
          options={[
            { value: "full", label: payAnswer.full },
            { value: "percent", label: payAnswer.percent },
          ]}
          help={value.deposit === "percent" ? t("payPartHelp", { pct: value.depositPct }) : t("payFullHelp")}
        />
        {value.deposit === "percent" && (
          <FormField
            label={t("advancePct")}
            variant="number"
            placeholder="30"
            value={String(value.depositPct)}
            onChange={(e) => set("depositPct", num(e.target.value))}
            help={t("advanceHelp")}
          />
        )}
      </Section>

      <Section title={t("section.group")} note={t("groupHelp", { min: value.partyMin, max: value.partyMax })}>
        <FormField label={t("groupMin")} variant="number" value={String(value.partyMin)} onChange={(e) => set("partyMin", num(e.target.value))} />
        <FormField label={t("groupMax")} variant="number" value={String(value.partyMax)} onChange={(e) => set("partyMax", num(e.target.value))} />
      </Section>

      <Section title={t("section.form")}>
        <FormField
          label={t("formLabel")}
          variant="toggle"
          checked={!!value.waiver}
          onChange={(e) => set("waiver", (e.target as HTMLInputElement).checked)}
          help={value.waiver ? t("formHelpOn") : t("formHelpOff")}
        />
      </Section>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label mb-tight text-[12px] text-muted">{title}</p>
      {note && <p className="-mt-inline mb-tight text-[13px] text-muted">{note}</p>}
      <div className="grid gap-section sm:grid-cols-2">{children}</div>
    </div>
  );
}
