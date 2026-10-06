"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { passwordStrength, type PasswordIssue, type PinIssue } from "@/lib/api";
import { controlCls } from "../../_components/SettingsKit";

/**
 * The pieces a password or a till PIN is typed with — shared by the invite
 * form and by "Set a new password" on a member's page, so the rules and the
 * words that refuse them are the same in both.
 *
 * The api decides what is acceptable (`passwordIssue`, `pinIssue`); these only
 * say it in the reader's own language, beside the field.
 */

/** A password refusal as a sentence in the current language. */
export function usePasswordMessage() {
  const t = useTranslations("settings");
  return (issue: PasswordIssue | null): string | undefined => {
    if (!issue) return undefined;
    switch (issue.code) {
      case "short":
        return t("team.pwErrShort", { min: issue.min, have: issue.have });
      case "email":
        return t("team.pwErrEmail");
      case "phone":
        return t("team.pwErrPhone");
      default:
        return t("team.pwErrCommon");
    }
  };
}

/** A PIN refusal as a sentence in the current language. */
export function usePinMessage() {
  const t = useTranslations("settings");
  return (issue: PinIssue | null): string | undefined => {
    if (!issue) return undefined;
    return t(`team.pinErr${issue[0].toUpperCase()}${issue.slice(1)}` as "team.pinErrDigits");
  };
}

/** A text field with a show/hide toggle. The toggle is a 44px target inside it. */
export function SecretInput({
  id,
  value,
  onChange,
  onBlur,
  show,
  onToggleShow,
  invalid,
  describedBy,
  showLabel,
  hideLabel,
  autoComplete = "new-password",
  inputMode,
  maxLength,
  placeholder,
  mono,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  show: boolean;
  onToggleShow: () => void;
  invalid?: boolean;
  describedBy?: string;
  showLabel: string;
  hideLabel: string;
  autoComplete?: string;
  inputMode?: "numeric";
  maxLength?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(controlCls(invalid), "pr-12", mono && "font-mono tracking-widest")}
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? hideLabel : showLabel}
        aria-pressed={show}
        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:text-fg"
      >
        {show ? <EyeOff size={18} strokeWidth={1.5} aria-hidden /> : <Eye size={18} strokeWidth={1.5} aria-hidden />}
      </button>
    </div>
  );
}

const LEVEL_FILL = ["", "bg-danger", "bg-warning", "bg-success", "bg-success"] as const;

/** Four bars and a plain word. The word, not the colour, carries the meaning. */
export function StrengthMeter({ password }: { password: string }) {
  const t = useTranslations("settings");
  const { level, key } = passwordStrength(password);
  const word =
    key === "weak"
      ? t("team.pwStrengthWeak")
      : key === "fair"
        ? t("team.pwStrengthFair")
        : key === "good"
          ? t("team.pwStrengthGood")
          : key === "strong"
            ? t("team.pwStrengthStrong")
            : "";
  return (
    <div className="mt-tight" data-strength={key}>
      <div aria-hidden className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= level ? LEVEL_FILL[level] : "bg-line")} />
        ))}
      </div>
      <p aria-live="polite" className="mt-inline text-[13px] text-muted">
        {key === "empty" ? (
          t("team.pwStrengthEmpty")
        ) : (
          <>
            {t("team.pwStrengthLabel")}: <span className="font-medium text-fg">{word}</span>
          </>
        )}
      </p>
    </div>
  );
}
