"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, SegmentedControl, Switch } from "@/components/ui";
import type { ReceiptPaper } from "@/components/receipt/types";

/** The receipt's own options for this print only — nothing here is saved. */
export interface PrintOptions {
  /** The logo switch. `available` is false when the business has no logo yet. */
  logo?: { checked: boolean; available: boolean; onChange: (next: boolean) => void };
  /** The paper choice. */
  paper?: { value: ReceiptPaper; options: ReceiptPaper[]; onChange: (next: ReceiptPaper) => void };
}

/** Back and Print, on screen only — the printed page carries nothing but what it prints. A receipt adds its options row. */
export function PrintToolbar({ options }: { options?: PrintOptions }) {
  const t = useTranslations("ticket");
  const router = useRouter();
  const paperLabel: Record<ReceiptPaper, string> = { "80mm": t("receipt.paper80"), "58mm": t("receipt.paper58"), a4: t("receipt.paperA4") };
  return (
    <div className="mb-major print:hidden">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.back()} className="flex min-h-[44px] items-center gap-inline text-sm text-muted hover:text-fg">
          <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
        </button>
        <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => window.print()}>
          {t("print")}
        </Button>
      </div>
      {options && (options.logo || options.paper) && (
        <div role="group" aria-label={t("receipt.options")} className="mt-section flex flex-wrap items-start gap-x-major gap-y-tight rounded-card border border-line bg-card px-section py-tight">
          {options.logo && (
            <div className="min-w-0">
              <Switch
                label={t("receipt.logoSwitch")}
                checked={options.logo.available && options.logo.checked}
                disabled={!options.logo.available}
                onChange={options.logo.onChange}
              />
              {!options.logo.available && (
                <p className="-mt-inline pb-tight text-xs text-muted">
                  <Link href="/settings/business" className="underline underline-offset-2 hover:text-fg">
                    {t("receipt.noLogoHint")}
                  </Link>
                </p>
              )}
            </div>
          )}
          {options.paper && (
            <div className="flex items-center gap-tight py-inline">
              <span id="print-paper-label" className="text-sm text-muted">{t("receipt.paperLabel")}</span>
              <SegmentedControl
                aria-labelledby="print-paper-label"
                value={options.paper.value}
                onChange={(v) => options.paper?.onChange(v as ReceiptPaper)}
                options={options.paper.options.map((p) => ({ value: p, label: paperLabel[p] }))}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
