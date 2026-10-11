"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, Calculator, Languages, Palette, Type } from "lucide-react";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { setPrefs, usePrefs, type TillText } from "@/lib/prefs";

/**
 * The till's own settings.
 *
 * More used to offer "Settings" and open **`/settings/business`** — the whole
 * admin app, in the middle of a shift, with the sidebar, the reports and the
 * tax rates in front of a cashier who wanted to turn the number pad off. The
 * owner's ask: *a POS-dedicated settings, only for POS*.
 *
 * So what is here is exactly what belongs to the screen in front of the person:
 * appearance, language, how large the type is, and whether the pad is drawn.
 * All four are **this browser's**, which is what a till is — one device, worked
 * by a morning and an evening cashier — and the page says so rather than
 * leaving somebody to wonder whose setting they just changed. The business's
 * own settings are one explicit link away, never the default.
 */
export default function TillSettingsPage() {
  const t = useTranslations("pos");
  const prefs = usePrefs();

  return (
    <div
      className="mx-auto flex w-full max-w-2xl flex-col gap-section p-section"
      /* The Go tab bar is a floating pill inset 12px and 64px tall, so it owns
         the bottom 76px. Without this the last card sits under it. */
      style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom))" }}
    >
      <header>
        <h1 className="text-xl font-semibold tracking-title">{t("tillSettings.title")}</h1>
        <p className="mt-inline text-sm text-muted">{t("tillSettings.thisDevice")}</p>
      </header>

      {/* The number pad. First, because it is the one the owner asked for and
          the one that changes how a sale is taken. */}
      {/* The line under the switch says what the CURRENT setting does, so a
          cashier reads the consequence rather than both branches of it. */}
      <Row icon={<Calculator size={18} strokeWidth={1.75} />} title={t("tillSettings.keypad")} body={t(prefs.posKeypad ? "tillSettings.keypadOn" : "tillSettings.keypadOff")}>
        <Switch
          aria-label={t("tillSettings.keypad")}
          checked={prefs.posKeypad}
          onChange={(next) => setPrefs({ posKeypad: next })}
        />
      </Row>

      <Row icon={<Type size={18} strokeWidth={1.75} />} title={t("textSize")} body={t("tillSettings.textBody")} stack>
        <div role="radiogroup" aria-label={t("textSize")} className="flex w-full gap-tight">
          {(["normal", "large", "largest"] as TillText[]).map((v, i) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={prefs.tillText === v}
              onClick={() => setPrefs({ tillText: v })}
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-full border transition-colors duration-quick",
                prefs.tillText === v ? "border-ember-solid bg-ember-solid font-medium text-on-solid" : "border-line text-muted active:bg-muted-wash",
              )}
            >
              {/* Each option set at the size it selects: three identical labels
                  are a guessing game about a choice that changes every screen
                  behind it. */}
              <span style={{ fontSize: [15, 17, 19][i] }}>{t(`textSize_${v}`)}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row icon={<Palette size={18} strokeWidth={1.75} />} title={t("tillSettings.appearance")} body={t("tillSettings.appearanceBody")} stack>
        <AppearancePicker showLabel={false} />
      </Row>

      <Row icon={<Languages size={18} strokeWidth={1.75} />} title={t("tillSettings.language")} body={t("tillSettings.languageBody")} stack>
        <LanguagePicker showLabel={false} />
      </Row>

      {/* Not a dead end: everything else a till obeys — payment methods, the
          starting cash, the allowed difference — is the business's, and set once for every
          device rather than on each one. */}
      <Link
        href="/settings/business"
        className="card-surface flex min-h-[3.5rem] items-center justify-between gap-tight p-card text-left"
      >
        <span className="min-w-0">
          <span className="block text-md font-medium">{t("tillSettings.business")}</span>
          <span className="mt-inline block text-sm text-muted">{t("tillSettings.businessBody")}</span>
        </span>
        <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
      </Link>

      {/* The rules this screen is drawn by, opened on the POS previews. */}
      <Link
        href="/design-system?product=go"
        className="card-surface flex min-h-[3.5rem] items-center justify-between gap-tight p-card text-left"
      >
        <span className="min-w-0">
          <span className="block text-md font-medium">{t("tillSettings.designSystem")}</span>
          <span className="mt-inline block text-sm text-muted">{t("tillSettings.designSystemBody")}</span>
        </span>
        <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
      </Link>
    </div>
  );
}

/** One setting: what it is and what it does on the left, the control on the
 *  right — or under it where the control needs the width. */
function Row({
  icon,
  title,
  body,
  children,
  stack = false,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
  stack?: boolean;
}) {
  return (
    <section className={cn("card-surface p-card", stack ? "flex flex-col gap-comfortable" : "flex items-center gap-comfortable")}>
      <div className="flex min-w-0 flex-1 items-start gap-comfortable">
        <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-brand-foreground">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-md font-medium">{title}</span>
          <span className="mt-inline block text-sm text-muted">{body}</span>
        </span>
      </div>
      {children}
    </section>
  );
}
