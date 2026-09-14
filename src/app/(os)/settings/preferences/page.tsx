"use client";

import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { SettingRow, SettingsSection } from "../_components/SettingsKit";

/**
 * The preferences that belong to the person, not the business.
 *
 * Appearance and language lived at the bottom of Business setup, between the
 * SMS template and the save button — so a cashier switching to dark mode was,
 * as far as the screen could tell them, editing the business. Both are stored
 * in this browser and apply the moment they are pressed, which is why there is
 * no save bar here: a button that saves something already saved teaches people
 * the other save buttons are optional too.
 */
export default function PreferencesPage() {
  const t = useTranslations("settings");
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
        <p className="max-w-prose text-[13px] text-muted">{t("preferences.note")}</p>
      </div>
    </PageShell>
  );
}
