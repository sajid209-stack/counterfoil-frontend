"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { lineSubtotal } from "@/lib/storefront/basket";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { StorefrontChrome } from "../Chrome";

/** The basket: every line with its date/time/place, a stepper per ticket
 *  type, subtotal, VAT, total, and the one way forward. */
export function BasketScreen() {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");

  const setQty = (lineId: string, tierId: string, qty: number) => {
    const line = flow.basket.find((l) => l.id === lineId);
    if (!line) return;
    const tiers = line.tiers.map((tr) => (tr.tierId === tierId ? { ...tr, qty: Math.max(0, Math.min(20, qty)) } : tr));
    flow.updateLine(lineId, { tiers });
  };

  return (
    <StorefrontChrome
      storefront={flow.storefront}
      location={flow.location}
      backHref={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
      backLabel={t("backToVenue", { venue: flow.location.name })}
      poweredBy={t("poweredBy")}
      preview={flow.mode === "preview"}
    >
      {flow.mode === "preview" && (
        <button
          type="button"
          onClick={flow.goVenue}
          className="mb-section flex min-h-11 items-center text-[13px] text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t("backToVenue", { venue: flow.location.name })}
        </button>
      )}
      <h1 className="type-h1 text-[26px] sm:text-[32px]">{t("basket.title")}</h1>

      {flow.basket.length === 0 ? (
        <div className="mt-section rounded-md border border-hairline bg-subtle p-card text-center">
          <p className="text-[14px] text-muted">{t("basket.empty")}</p>
          <Button className="mt-comfortable" onClick={flow.goVenue}>
            {t("basket.browse")}
          </Button>
        </div>
      ) : (
        <div className="mt-section flex flex-col gap-section">
          <ul className="flex flex-col gap-comfortable">
            {flow.basket.map((line) => (
              <li key={line.id} className="card-surface flex flex-col gap-comfortable p-card">
                <div className="flex items-start justify-between gap-comfortable">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{line.productName}</p>
                    <p className="text-[13px] text-muted">
                      {[
                        flow.location.name,
                        line.date ? formatDay(line.date, { weekday: true }) : null,
                        line.startTime ? formatClock(line.startTime) : null,
                        line.resourceName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t("basket.remove", { name: line.productName })}
                    onClick={() => flow.removeLine(line.id)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-danger"
                  >
                    <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                <ul className="divide-y divide-hairline border-t border-hairline">
                  {line.tiers.map((tr) => (
                    <li key={tr.tierId} className="flex items-center justify-between gap-comfortable py-tight">
                      <div className="min-w-0">
                        <p className="truncate text-[14px]">{tr.tierName}</p>
                        <p className="text-[13px] text-muted">{formatMoney(tr.price)} {t("basket.each")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-tight">
                        {!tr.tierId.startsWith("addon_") && (
                          <>
                            <button
                              type="button"
                              aria-label={t("booking.decreaseQty", { name: tr.tierName })}
                              onClick={() => setQty(line.id, tr.tierId, tr.qty - 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line"
                            >
                              <Minus size={14} strokeWidth={2} aria-hidden />
                            </button>
                            <span className="w-5 text-center text-[14px] font-medium tabular-nums">{tr.qty}</span>
                            <button
                              type="button"
                              aria-label={t("booking.increaseQty", { name: tr.tierName })}
                              onClick={() => setQty(line.id, tr.tierId, tr.qty + 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-sm border border-line"
                            >
                              <Plus size={14} strokeWidth={2} aria-hidden />
                            </button>
                          </>
                        )}
                        <span className="w-20 shrink-0 text-right text-[14px] font-semibold tabular-nums">{formatMoney(tr.price * tr.qty)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="flex items-baseline justify-between border-t border-hairline pt-tight text-[14px] font-semibold">
                  <span>{t("basket.lineSubtotal")}</span>
                  <span className="tabular-nums">{formatMoney(lineSubtotal(line))}</span>
                </p>
              </li>
            ))}
          </ul>

          <div className="card-surface flex flex-col gap-tight p-card">
            <Row label={t("basket.subtotal")} value={formatMoney(flow.totals.subtotal)} />
            {flow.totals.taxTotal > 0 && <Row label={t("basket.vat")} value={formatMoney(flow.totals.taxTotal)} />}
            <Row label={t("basket.total")} value={formatMoney(flow.totals.total)} strong />
            <Button fullWidth size="lg" className="mt-tight" onClick={flow.goCheckout}>
              {t("basket.continue")}
            </Button>
          </div>
        </div>
      )}
    </StorefrontChrome>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={`flex items-baseline justify-between ${strong ? "border-t border-hairline pt-tight text-[17px] font-semibold" : "text-[14px] text-muted"}`}>
      <span>{label}</span>
      <span className="tabular-nums text-fg">{value}</span>
    </p>
  );
}
