"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { setPrefs, usePrefs } from "@/lib/prefs";
import { SettingRow, SettingsSection, Switch } from "../_components/SettingsKit";

const noSubscribe = () => () => {};

/**
 * The preferences that belong to the person, not the business.
 *
 * Appearance and language lived at the bottom of Business setup, between the
 * SMS template and the save button — so a cashier switching to dark mode was,
 * as far as the screen could tell them, editing the business. Both are stored
 * in this browser and apply the moment they are pressed, which is why there is
 * no save bar here: a button that saves something already saved teaches people
 * the other save buttons are optional too.
 *
 * Preference pages worth copying — GitHub, Linear, Slack, Notion — all add the
 * same few things beside the theme: reduce motion, increase contrast, how the
 * workspace is laid out, and the keyboard shortcuts. Each one here does what it
 * says the moment it is switched. Text size and a 12-hour clock were left out:
 * sizes here are set in pixels and dates are formatted in one place for every
 * screen, so a switch for either would change some screens and not others.
 */
export default function PreferencesPage() {
  const t = useTranslations("settings");
  const prefs = usePrefs();
  const mac = useSyncExternalStore(noSubscribe, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);

  const shortcuts: { keys: string[]; label: string }[] = [
    { keys: [mac ? "⌘" : "Ctrl", "K"], label: t("preferences.shortcut.search") },
    { keys: ["Esc"], label: t("preferences.shortcut.close") },
    { keys: ["←", "→", "↑", "↓"], label: t("preferences.shortcut.days") },
  ];

  return (
    <PageShell title={t("preferences.title")} description={t("preferences.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("preferences.displayTitle")} description={t("preferences.displayDesc")}>
          <SettingRow label={t("preferences.appearance")} description={t("preferences.appearanceDesc")} labelFor={false}>
            {({ labelId, describedBy }) => <AppearancePicker showLabel={false} labelledBy={labelId} describedBy={describedBy} />}
          </SettingRow>
          <SettingRow label={t("preferences.language")} description={t("preferences.languageDesc")} labelFor={false}>
            {({ labelId, describedBy }) => <LanguagePicker showLabel={false} labelledBy={labelId} describedBy={describedBy} />}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("preferences.accessTitle")} description={t("preferences.accessDesc")}>
          <SettingRow label={t("preferences.reduceMotion")} description={t("preferences.reduceMotionDesc")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={prefs.reduceMotion}
                  onChange={(on) => setPrefs({ reduceMotion: on })}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("preferences.contrast")} description={t("preferences.contrastDesc")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={prefs.moreContrast}
                  onChange={(on) => setPrefs({ moreContrast: on })}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("preferences.workspaceTitle")} description={t("preferences.workspaceDesc")}>
          <SettingRow label={t("preferences.sidebar")} description={t("preferences.sidebarDesc")} labelFor={false}>
            {({ labelId, describedBy }) => (
              <div className="flex sm:justify-end">
                <Switch
                  checked={prefs.sidebarCollapsed}
                  onChange={(on) => setPrefs({ sidebarCollapsed: on })}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("preferences.shortcutsTitle")} description={t("preferences.shortcutsDesc")}>
          <dl className="divide-y divide-hairline">
            {shortcuts.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-section px-card py-comfortable">
                <dt className="text-sm text-fg">{s.label}</dt>
                <dd className="flex shrink-0 gap-inline">
                  {s.keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex min-w-7 items-center justify-center rounded-xs border border-line bg-card px-tight py-inline font-mono text-[12px] text-fg shadow-[inset_0_-1px_0_var(--color-line)]"
                    >
                      {k}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </SettingsSection>

        <p className="max-w-prose text-[13px] text-muted">{t("preferences.note")}</p>
      </div>
    </PageShell>
  );
}
