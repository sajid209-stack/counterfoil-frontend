"use client";

import { useTranslations } from "next-intl";
import { Globe, LineChart, Play, type LucideIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui";

/** A side card: a soft icon tile, a 16px title, a 13px muted sentence and one quiet action. */
function SideCard({ Icon, title, body, tag, children }: { Icon: LucideIcon; title: string; body: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-card">
      <div className="flex items-center gap-comfortable">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-subtle text-fg-secondary">
          <Icon size={17} strokeWidth={1.5} />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-md font-semibold">{title}</h3>
        {tag && <span className="shrink-0 text-xs text-muted">{tag}</span>}
      </div>
      <p className="mt-comfortable text-sm text-muted">{body}</p>
      <div className="mt-section">{children}</div>
    </section>
  );
}

/**
 * The column beside the guide: ways to try the product while setting it up, and a
 * muted look at what this page becomes once there is something to show. It is a
 * description, not a chart - no empty graphs on a business with no sales.
 */
export function SetupSide() {
  const t = useTranslations("dashboard.setup");
  
  const ahead = [t("previewSales"), t("previewPlaces"), t("previewArrived")];
  return (
    <aside aria-label={t("tryTitle")} className="flex min-w-0 flex-col gap-section">
      <SideCard Icon={Play} title={t("tryTitle")} body={t("tryBody")}>
        <ButtonLink href="/pos" variant="secondary" size="sm">{t("tryAction")}</ButtonLink>
      </SideCard>
      <SideCard Icon={Globe} title={t("pageTitle")} body={t("pageBody")} tag={t("optional")}>
        <ButtonLink href="/settings/storefront" variant="secondary" size="sm">{t("pageAction")}</ButtonLink>
      </SideCard>

      {/* What it becomes. Quiet on purpose: a dashed outline and muted type say
          "not yet", and the three figures are dashes, not invented numbers. */}
      <section data-setup-preview className="rounded-card border border-dashed border-line p-card text-muted">
        <div className="flex items-center gap-comfortable">
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted-wash">
            <LineChart size={17} strokeWidth={1.5} />
          </span>
          <h3 className="min-w-0 flex-1 truncate text-md font-semibold text-fg-secondary">{t("laterTitle")}</h3>
        </div>
        <p className="mt-comfortable text-sm">{t("laterBody")}</p>
        <dl className="mt-section grid grid-cols-3 gap-tight">
          {ahead.map((label) => (
            <div key={label} className="min-w-0 rounded-control bg-muted-wash px-comfortable py-tight">
              <dt className="truncate text-xs">{label}</dt>
              <dd className="text-md font-semibold">&mdash;</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
