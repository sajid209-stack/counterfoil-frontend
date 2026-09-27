"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Barcode, PageShell, Qr, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getTicketCodeSettings, listInventory, updateTicketCodeSettings } from "@/lib/api";
import type { TicketCodeSettings } from "@/lib/api";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection, Switch } from "../_components/SettingsKit";

/** A code shaped like the real thing, so the drawing is the width the real one will be. */
const SAMPLE = "CF-2026-000123-01";

type Print = TicketCodeSettings["print"];
const PRINTS: Print[] = ["qr", "barcode", "both"];

/**
 * Ticket codes — what a ticket carries, and what the till listens for.
 *
 * The product has always printed a QR, which suits a phone camera and the
 * imager in a modern gate scanner. It does not suit the scanner most counters
 * here already own: a laser handheld reads linear barcodes and cannot see a QR
 * at all, so a venue with one could not scan its own tickets.
 *
 * The choice is made by LOOKING at it. Each option draws the code it means, at
 * the size a ticket prints it, because "Code 39" tells an operator nothing and
 * the picture tells them everything — including that a barcode is wide, which
 * is the one thing that might change their mind.
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
          <SettingRow label={t("tickets.printLabel")} description={t("tickets.printHelp")} layout="stack" labelFor={false}>
            {() => (
              <div role="radiogroup" aria-label={t("tickets.printLabel")} className="grid gap-comfortable sm:grid-cols-3">
                {PRINTS.map((p) => {
                  const on = form.print === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ print: p })}
                      className={cn(
                        "flex flex-col items-center gap-tight rounded-sm border p-comfortable text-center transition-colors duration-quick",
                        on ? "border-ember bg-ember/5" : "border-line hover:border-strong",
                      )}
                    >
                      {/* Drawn at the size a ticket prints it, on white,
                          because that is where it will be read.

                          `aria-hidden`: a QR and a barcode carry their own
                          accessible names, which is right on a ticket and
                          wrong here — they made this option announce as "QR
                          code CF-2026-000123-01 Barcode CF-2026-000123-01
                          Both …", two readings of a sample code before the
                          option's own name. Here they are the illustration
                          and the label is the choice. */}
                      <span aria-hidden className="flex min-h-[88px] w-full items-center justify-center gap-comfortable overflow-hidden rounded-xs bg-white p-tight">
                        {p !== "barcode" && <Qr value={SAMPLE} size={72} />}
                        {p !== "qr" && <Barcode value={SAMPLE} height={56} unit={1} className="max-w-full" />}
                      </span>
                      <span className="text-sm font-medium text-fg">{t(`tickets.print_${p}`)}</span>
                      <span className="text-[13px] text-muted">{t(`tickets.print_${p}_desc`)}</span>
                    </button>
                  );
                })}
              </div>
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
