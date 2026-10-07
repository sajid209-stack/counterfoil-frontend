"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { PageShell, Qr, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getTicketCodeSettings, listInventory, updateTicketCodeSettings } from "@/lib/api";
import type { TicketCodeSettings } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch } from "../_components/SettingsKit";

/** A code shaped like the real thing, so the drawing is the width the real one will be. */
const SAMPLE = "CF-2026-000123-01";

/**
 * Ticket codes — what a ticket carries, and what the till listens for.
 *
 * A ticket carries a QR. It used to offer a Code 39 barcode or both as well,
 * for the laser handhelds that cannot see a QR; the owner asked for QR only
 * (2026-10-06), so there is nothing to choose here any more and the page says
 * what the ticket carries rather than asking. What is still the venue's call is
 * whether the code is also printed in letters, so it can be typed when a
 * scanner will not read, and whether the till listens for a scanned shop item.
 */
export default function TicketCodesPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const setQ = useApiQuery(() => getTicketCodeSettings(), []);
  const invQ = useApiQuery(() => listInventory({ pageSize: 200 }), []);

  const [base, setBase] = useState<TicketCodeSettings | null>(null);
  const [draft, setDraft] = useState<TicketCodeSettings | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = base ?? setQ.data ?? null;
  const form = draft ?? saved;

  if (!form || !saved) {
    return (
      <PageShell title={t("tickets.title")} description={t("tickets.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<TicketCodeSettings>) => setDraft({ ...form, ...patch });

  /* Scanning to sell needs something to match against. An operator turning it
     on with no SKUs anywhere would get a till that listens and never answers,
     so the row says how many items can actually be found. */
  const items = invQ.data?.data ?? [];
  const withSku = items.filter((i) => (i.sku ?? "").trim()).length;

  const save = async () => {
    setSaving(true);
    const res = await updateTicketCodeSettings(form);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setBase(res.data);
    setDraft(null);
    toast.success(t("tickets.saved"));
  };

  return (
    <PageShell title={t("tickets.title")} description={t("tickets.description")}>
      <div className="flex flex-col gap-section">
        <SettingsSection title={t("tickets.printTitle")} description={t("tickets.printDesc")}>
          {/* A fact, not a choice: the sample is drawn at the size a ticket
              prints it, on white, because that is where it will be read. It is
              the illustration — the row's words are its name — so it is hidden
              from the accessibility tree. */}
          <SettingRow label={t("tickets.printLabel")} description={t("tickets.printHelp")} labelFor={false}>
            {() => (
              <span aria-hidden data-ticket-code-sample className="inline-flex items-center justify-center rounded-xs border border-line bg-white p-tight">
                <Qr value={SAMPLE} size={72} />
              </span>
            )}
          </SettingRow>

          <SettingRow label={t("tickets.showText")} description={t("tickets.showTextDesc")}>
            {({ labelId, describedBy }) => (
              <Switch checked={form.showText} onChange={(v) => set({ showText: v })} labelledBy={labelId} describedBy={describedBy} />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("tickets.tillTitle")} description={t("tickets.tillDesc")}>
          <SettingRow
            label={t("tickets.scanToSell")}
            description={
              withSku === 0 && items.length > 0
                ? t("tickets.scanToSellNone")
                : t("tickets.scanToSellDesc", { count: withSku })
            }
          >
            {({ labelId, describedBy }) => (
              <Switch checked={form.scanToSell} onChange={(v) => set({ scanToSell: v })} labelledBy={labelId} describedBy={describedBy} />
            )}
          </SettingRow>
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}
