"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/locale";

/** Persist the locale as a device cookie and re-render server + client in sync
 *  via a soft refresh (keeps the POS session/mock store — a hard reload resets
 *  it). Mirrors the theme toggle pattern. */
function useSetLocale() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setLocale = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };
  return { setLocale, pending };
}

/** One-tap language flip (EN ↔ বাংলা), parallel to the header ModeButton. */
export function LocaleToggle({ className }: { className?: string }) {
  const locale = useLocale() as Locale;
  const { setLocale } = useSetLocale();
  const next: Locale = locale === "en" ? "bn" : "en";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={`Switch to ${LOCALE_LABELS[next]}`}
      aria-label={`Switch to ${LOCALE_LABELS[next]}`}
      className={`flex h-11 items-center gap-inline rounded-sm border border-line bg-card px-comfortable text-[13px] text-muted transition-colors duration-quick hover:border-ember/40 hover:text-fg active:bg-ember/10 ${className ?? ""}`}
    >
      <Languages size={16} strokeWidth={1.5} />
      <span className="font-medium">{LOCALE_LABELS[next]}</span>
    </button>
  );
}

/** The language picker — OS Settings and the Go shift menu share it. */
export function LanguagePicker({
  className,
  showLabel = true,
  labelledBy,
  describedBy,
}: {
  className?: string;
  /** Off where the surrounding row already names the control. */
  showLabel?: boolean;
  labelledBy?: string;
  describedBy?: string;
}) {
  const locale = useLocale() as Locale;
  const { setLocale } = useSetLocale();
  const t = useTranslations("common");
  const ownLabelId = useId();
  return (
    <div className={className}>
      {showLabel && (
        <span id={ownLabelId} className="type-label mb-tight block text-[12px] text-muted">
          {t("language")}
        </span>
      )}
      <div role="group" aria-labelledby={showLabel ? ownLabelId : labelledBy} aria-describedby={describedBy} className="flex gap-tight">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            // Each option is written in its own language, so a screen reader
            // has to be told to pronounce "বাংলা" as Bangla.
            lang={l}
            onClick={() => setLocale(l)}
            aria-pressed={locale === l}
            className={`h-11 flex-1 rounded-sm border text-sm transition-colors duration-quick ${locale === l ? "border-ember bg-ember/5 font-medium" : "border-line bg-card"}`}
          >
            {LOCALE_LABELS[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
