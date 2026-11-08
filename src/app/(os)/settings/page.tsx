"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { SettingsSheetList } from "../_components/mobile/SettingsSheetList";
import { useSettingsAttention } from "./_lib/attention";
import { useResourceNoun } from "./_lib/nav";

/**
 * Settings, the list (docs/mobile.md §8): on a phone, Settings is a page of its
 * own — a large title and every section as a plain row, the way Shopify's
 * mobile admin opens it — and a section's back button returns here.
 *
 * From md up the shell draws the sections in a column beside the page, so a
 * list here would say the same thing twice: the page moves straight on to the
 * first section, as /settings always has.
 */
export default function SettingsIndexPage() {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const wide = useMediaQuery(MD);
  const noun = useResourceNoun();
  const attention = useSettingsAttention();

  useEffect(() => {
    if (wide) router.replace("/settings/business");
  }, [wide, router]);

  if (wide) return null;
  return (
    <PageShell title={t("settings")}>
      <SettingsSheetList pathname={pathname} noun={noun} attention={attention} inPage />
    </PageShell>
  );
}
