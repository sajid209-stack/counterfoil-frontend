"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowUpRight, Calculator, Languages, Palette, Type } from "lucide-react";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { SegmentedControl, Switch } from "@/components/ui";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";
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
 *
 * On a desktop the rows are one white card of hairline rows, with each control
 * on the right; on a phone every row is still its own card.
 */

/* A group is one card of hairline rows on a desktop; on a phone each row is
   its own card, as it always was. */
const GROUP = "flex flex-col gap-comfortable rail:rounded-card rail:bg-card rail:shadow-card rail:gap-0 rail:overflow-hidden";
const ROW = "rail:rounded-none rail:border-t rail:border-line rail:bg-transparent rail:shadow-none rail:first:border-t-0";

export default function TillSettingsPage() {
  const t = useTranslations("pos");
  const prefs = usePrefs();

  return (
    <GoPage width="narrow">
      <div
        className="mx-auto w-full max-w-160 pb-(--tab-clear) pt-tight rail:max-w-none rail:pb-0 rail:pt-0 [&_[role=radio]]:min-h-11"
        /* The Go tab bar is docked and 64px tall, so it owns
           the bottom 64px. Without this the last card sits under it. */
        style={{ "--tab-clear": "calc(88px + env(safe-area-inset-bottom))" } as React.CSSProperties}
      >
        <GoPageHeader title={t("tillSettings.title")} subtitle={t("tillSettings.thisDevice")} className="mb-comfortable! rail:mb-major!" />

        <div className="flex flex-col gap-comfortable rail:gap-section">
        <div className={GROUP}>
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
            <SegmentedControl
              fullWidth
              aria-label={t("textSize")}
              value={prefs.tillText}
              onChange={(v) => setPrefs({ tillText: v as TillText })}
              options={(["normal", "large", "largest"] as TillText[]).map((v) => ({ value: v, label: t(`textSize_${v}`) }))}
            />
          </Row>

          <Row icon={<Palette size={18} strokeWidth={1.75} />} title={t("tillSettings.appearance")} body={t("tillSettings.appearanceBody")} stack>
            <AppearancePicker showLabel={false} />
          </Row>

          <Row icon={<Languages size={18} strokeWidth={1.75} />} title={t("tillSettings.language")} body={t("tillSettings.languageBody")} stack>
            <LanguagePicker showLabel={false} />
          </Row>
        </div>

        <div className={GROUP}>
          {/* Not a dead end: everything else a till obeys — payment methods, the
              starting cash, the allowed difference — is the business's, and set once for every
              device rather than on each one. */}
          <Link
            href="/settings/business"
            className={`card-surface flex min-h-[3.5rem] items-center justify-between gap-tight p-card text-left rail:hover:bg-nav-hover ${ROW}`}
          >
            <span className="min-w-0">
              <span className="block text-md font-semibold">{t("tillSettings.business")}</span>
              <span className="mt-inline block text-sm text-muted">{t("tillSettings.businessBody")}</span>
            </span>
            <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          </Link>

          {/* The rules this screen is drawn by, opened on the POS previews. */}
          <Link
            href="/design-system?product=go"
            className={`card-surface flex min-h-[3.5rem] items-center justify-between gap-tight p-card text-left rail:hover:bg-nav-hover ${ROW}`}
          >
            <span className="min-w-0">
              <span className="block text-md font-semibold">{t("tillSettings.designSystem")}</span>
              <span className="mt-inline block text-sm text-muted">{t("tillSettings.designSystemBody")}</span>
            </span>
            <ArrowUpRight size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-muted" />
          </Link>
        </div>
        </div>
      </div>
    </GoPage>
  );
}

/** One setting: what it is and what it does on the left, the control on the
 *  right — or under it on a phone where the control needs the width. */
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
    <GoCard as="div" className={`${stack ? "rail:flex-row rail:items-center rail:justify-between" : "flex-row items-center"} ${ROW}`}>
      <div className="flex min-w-0 flex-1 items-start gap-comfortable">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle text-fg">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-md font-semibold">{title}</span>
          <span className="mt-inline block text-sm text-muted">{body}</span>
        </span>
      </div>
      {stack ? <div className="rail:w-80 rail:shrink-0">{children}</div> : children}
    </GoCard>
  );
}
