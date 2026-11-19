"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { RadioGroup, SegmentedControl } from "@/components/ui";
import { payNowChoices } from "@/lib/payNow";
import { formatMoney } from "@/lib/format";
import { SuffixInput } from "../../_components/SettingsKit";
import { OPTION_ORDER, SAMPLE, allowsZero, defaultValue, needsMin, parseMin, toRule, type RuleDraft } from "./ruleDraft";

/**
 * One rule, edited: which choices sit beside Full, and the minimum.
 *
 * The business default and a booking's own rule are the same question, so both
 * pages draw this. It is controlled and holds nothing: the page owns the draft
 * and decides when it is saved.
 */
export function RuleEditor({
  draft,
  onChange,
  currency,
  symbol,
  name,
}: {
  draft: RuleDraft;
  onChange: (next: RuleDraft) => void;
  currency: string;
  symbol: string;
  /** Distinguishes the radio groups when two editors are on one page. */
  name: string;
}) {
  const t = useTranslations("moneysetup.payNow");
  const ids = useId();
  const fieldId = `${ids}-min`;
  const errId = `${ids}-err`;
  const helpId = `${ids}-help`;
  const showMin = needsMin(draft.options);
  const zero = allowsZero(draft.options);
  const invalid = showMin && parseMin(draft) === null;
  const err = invalid
    ? draft.kind === "percent"
      ? t(zero ? "invalidPercentZero" : "invalidPercent")
      : t(zero ? "invalidAmountZero" : "invalidAmount")
    : undefined;

  const rule = toRule(draft);
  const choices = rule ? payNowChoices([{ rule, total: SAMPLE, later: true }]) : null;
  const parts = choices
    ? [
        t("exFull", { amount: formatMoney(choices.total, currency) }),
        choices.minimum != null ? t("exMin", { amount: formatMoney(choices.minimum, currency) }) : null,
        choices.customMin != null ? t("exAny", { amount: formatMoney(choices.customMin, currency) }) : null,
      ].filter((p): p is string => !!p)
    : [];

  return (
    <div className="flex flex-col gap-section">
      <RadioGroup
        name={name}
        aria-label={t("group")}
        value={draft.options}
        onChange={(v) => {
          const options = v as RuleDraft["options"];
          // Leaving "Full only" with an empty or zero field offers a sensible
          // starting figure rather than a field already in error.
          const fresh = !needsMin(draft.options) && parseMin({ ...draft, options }) === null;
          onChange({ ...draft, options, ...(fresh ? { value: defaultValue(draft.kind) } : {}) });
        }}
        options={OPTION_ORDER.map((o) => ({ value: o, label: <span className="font-medium">{t(`options.${o}.title`)}</span>, description: t(`options.${o}.desc`) }))}
      />

      {showMin && (
        <div>
          <label htmlFor={fieldId} className="text-base font-medium text-fg">
            {t(draft.options === "full_custom" ? "leastCustom" : "leastMin")}
          </label>
          <div className="mt-tight flex gap-tight">
            <SegmentedControl
              size="sm"
              className="shrink-0 self-start"
              aria-label={t("minKind")}
              value={draft.kind}
              options={[
                { value: "percent", label: "%", ariaLabel: t("percentOfTotal") },
                { value: "amount", label: symbol, ariaLabel: t("fixedAmount") },
              ]}
              onChange={(v) => {
                const kind = v as RuleDraft["kind"];
                if (kind === draft.kind) return;
                onChange({ ...draft, kind, value: zero ? "0" : defaultValue(kind) });
              }}
            />
            <div className="min-w-0 flex-1 sm:max-w-48">
              <SuffixInput
                id={fieldId}
                value={draft.value}
                onChange={(value) => onChange({ ...draft, value })}
                suffix={draft.kind === "percent" ? "%" : symbol}
                invalid={invalid}
                describedBy={err ? `${errId} ${helpId}` : helpId}
                inputMode={draft.kind === "percent" ? "numeric" : "decimal"}
              />
            </div>
          </div>
          <p id={helpId} className="mt-tight text-sm leading-relaxed text-muted">
            {draft.options === "full_custom" ? t("helpCustom", { symbol }) : t("helpMin")}
          </p>
          {err && (
            <p id={errId} className="mt-tight text-xs text-danger">
              {err}
            </p>
          )}
        </div>
      )}

      {parts.length > 0 && (
        <p className="rounded-control bg-muted-wash px-comfortable py-tight text-sm leading-relaxed text-muted">
          {t("example", { total: formatMoney(SAMPLE, currency), choices: parts.join(" · ") })}
        </p>
      )}
    </div>
  );
}
