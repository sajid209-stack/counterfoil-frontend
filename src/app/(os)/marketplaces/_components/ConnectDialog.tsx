"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Button, FormField, Modal, useToast } from "@/components/ui";
import { connectMarketplace } from "@/lib/api";
import type { MarketplaceId } from "@/lib/api";
import {
  bpsToPct,
  marketInitials,
  marketplaceById,
  pctToBps,
  split,
  type MarketplaceMeta,
} from "@/lib/marketplaces";
import { formatMoney } from "@/lib/format";

/** The worked example every commission field carries. A round number an
 *  operator recognises beats a real price they have to look up. */
const EXAMPLE: number = 150000;

/**
 * The onboarding, in one step rather than a wizard.
 *
 * The research describes a long real-world process — apply, be accepted,
 * agree a contract, then connect — but only the last part is Counterfoil's.
 * Pretending to own the application would be inventing a flow that ends at
 * somebody else's website, so the dialog says plainly what has to have
 * happened first and links there.
 *
 * **Which site is either already decided or genuinely a question.** Opened from
 * a site's own card or page, the answer is known, so it is shown as a fixed
 * header — its mark and its name — and there is no dropdown to second-guess it.
 * Opened from the list's general "Connect a site", the operator is choosing, so
 * `choices` is given and the dropdown stays, offering only the sites that are
 * not connected yet.
 */
export function ConnectDialog({
  marketplaceId,
  choices,
  onClose,
  onDone,
}: {
  marketplaceId: MarketplaceId;
  /** Present only where the operator really picks the site. Absent means the
   *  site is fixed. */
  choices?: MarketplaceMeta[];
  onClose: () => void;
  onDone: (connectionId: string) => void;
}) {
  const t = useTranslations("marketplaces");
  const toast = useToast();
  const [which, setWhich] = useState<MarketplaceId>(marketplaceId);
  const meta = marketplaceById(which);
  const [pct, setPct] = useState(String(bpsToPct(meta.typicalBps)));
  const [account, setAccount] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bps = pctToBps(parseFloat(pct) || 0);
  const s = split(EXAMPLE, bps);
  const valid = bps >= 0 && bps < 10000;

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await connectMarketplace({
      marketplaceId: which,
      commissionBps: bps,
      accountRef: account.trim() || undefined,
      apiKey: key.trim() || undefined,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(t("connected", { name: meta.name }));
      onDone(res.data.id);
    } else setError(res.error.message);
  };

  return (
    <Modal open onClose={onClose} title={t("dialog.title")} description={t("dialog.body")}>
      <div className="flex flex-col gap-section">
        {choices ? (
          <FormField
            label={t("dialog.which")}
            variant="select"
            value={which}
            options={choices.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(e) => {
              const id = e.target.value as MarketplaceId;
              setWhich(id);
              setPct(String(bpsToPct(marketplaceById(id).typicalBps)));
            }}
          />
        ) : (
          /* The site is known: say which, once, as a header rather than a
             control. Not a form field — nothing here can be changed. */
          <div data-connect-site className="flex items-center gap-comfortable rounded-sm border border-line bg-subtle p-comfortable">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-market-solid text-[1.125rem] font-bold leading-none text-white"
            >
              {marketInitials(which)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-fg">{meta.name}</p>
              <p className="text-[13px] text-muted">
                {t(`sells.${meta.sells}`)} · {t("typically", { pct: bpsToPct(meta.typicalBps) })}
              </p>
            </div>
          </div>
        )}

        {/* What must already be true. Said before the fields, because finding
            out afterwards is what makes an onboarding feel like a trap. */}
        <div className="rounded-sm border border-line bg-subtle p-comfortable text-[13px]">
          <p className="font-medium">{t("dialog.firstTitle", { name: meta.name })}</p>
          <p className="mt-inline text-muted">{t("dialog.firstBody", { name: meta.name })}</p>
          <a
            href={meta.helpUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-tight inline-flex min-h-11 items-center gap-inline text-brand-foreground underline underline-offset-2 sm:min-h-0"
          >
            {t("dialog.open", { name: meta.name })} <ArrowUpRight size={13} strokeWidth={1.5} />
          </a>
        </div>

        <FormField
          label={t("dialog.commission")}
          variant="number"
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          help={t("dialog.commissionHelp")}
          error={valid ? undefined : t("dialog.commissionBad")}
        />
        {/* The worked example. A commission is a percentage until it is stated
            as money, and then it is a decision. */}
        {valid && (
          <p className="-mt-tight text-[13px] text-muted">
            {t("dialog.example", { price: formatMoney(s.price), commission: formatMoney(s.commission), net: formatMoney(s.net) })}
          </p>
        )}

        {meta.needs === "apiKey" ? (
          <FormField label={t("dialog.apiKey")} value={key} onChange={(e) => setKey(e.target.value)} help={t("dialog.apiKeyHelp")} />
        ) : (
          <FormField label={t("dialog.account")} value={account} onChange={(e) => setAccount(e.target.value)} help={t("dialog.accountHelp")} />
        )}

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="flex flex-wrap gap-tight">
          <Button loading={busy} onClick={go}>{t("dialog.connect")}</Button>
          <Button variant="secondary" onClick={onClose}>{t("dialog.cancel")}</Button>
        </div>
      </div>
    </Modal>
  );
}
