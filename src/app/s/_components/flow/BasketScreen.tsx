"use client";

import { useTranslations } from "next-intl";
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import { lineSubtotal } from "@/lib/storefront/basket";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { BackLink, StorefrontChrome } from "../Chrome";
import { Media, sfBtn } from "../sf";

/** The basket: every line with its date/time/place, a stepper per ticket
 *  type, and an order summary beside it (below it on a phone). */
export function BasketScreen() {
  const flow = useStorefrontFlow();
  const t = useTranslations("storefront");

  const setQty = (lineId: string, tierId: string, qty: number) => {
    const line = flow.basket.find((l) => l.id === lineId);
    if (!line) return;
    const tiers = line.tiers.map((tr) => (tr.tierId === tierId ? { ...tr, qty: Math.max(0, Math.min(20, qty)) } : tr));
    flow.updateLine(lineId, { tiers });
  };

  const stepper =
    "flex h-11 w-11 items-center justify-center rounded-full border border-strong bg-white text-fg transition-colors hover:border-fg";

  return (
    <StorefrontChrome storefront={flow.storefront} location={flow.location} poweredBy={t("poweredBy")}>
      <div className="pt-section">
        <BackLink
          label={t("backToVenue", { venue: flow.location.name })}
          href={flow.mode === "live" ? `/s/${flow.storefront.slug}` : undefined}
        />
      </div>
      <h1 className="mt-tight text-[32px] font-semibold tracking-[-0.03em] sm:text-[40px]">{t("basket.title")}</h1>

      {flow.basket.length === 0 ? (
        <div className="mt-major flex flex-col items-center rounded-[20px] border border-hairline bg-subtle px-section py-hero text-center">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[var(--sf-ink)] shadow-[0_6px_20px_rgba(0,0,0,0.08)]">
            <ShoppingBag size={28} strokeWidth={1.5} />
          </span>
          <p className="mt-section text-[18px] font-semibold">{t("basket.empty")}</p>
          <p className="mt-inline max-w-[40ch] text-[16px] text-muted">{t("basket.emptyHelp")}</p>
          <button type="button" className={`${sfBtn.primary} mt-major`} onClick={flow.goVenue}>
            {t("basket.browse")}
          </button>
        </div>
      ) : (
        <div className="mt-major grid grid-cols-1 items-start gap-major lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-wide">
          <ul className="flex flex-col gap-section">
            {flow.basket.map((line) => {
              const product = flow.products.find((p) => p.id === line.productId);
              return (
                <li key={line.id} className="rounded-[16px] border border-hairline p-section">
                  <div className="flex items-start gap-comfortable">
                    <Media
                      src={product?.images?.[0]?.url}
                      alt={product?.name ?? line.productName}
                      bookingType={product?.bookingType}
                      seed={line.productId}
                      iconSize={14}
                      className="aspect-[4/3] w-24 shrink-0 rounded-[12px] sm:w-32"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[18px] font-semibold leading-snug">{line.productName}</p>
                      <p className="mt-inline text-[14px] text-muted">
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
                      className="-mr-tight -mt-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors duration-quick hover:bg-subtle hover:text-danger"
                    >
                      <Trash2 size={18} strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                  <ul className="mt-section divide-y divide-hairline border-t border-hairline">
                    {line.tiers.map((tr) => (
                      <li key={tr.tierId} className="flex items-center justify-between gap-comfortable py-comfortable">
                        <div className="min-w-0">
                          <p className="text-[15px] font-medium">{tr.tierName}</p>
                          <p className="tnum text-[14px] text-muted">
                            {formatMoney(tr.price)} {t("basket.each")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-tight">
                          {!tr.tierId.startsWith("addon_") && (
                            <>
                              <button
                                type="button"
                                aria-label={t("booking.decreaseQty", { name: tr.tierName })}
                                onClick={() => setQty(line.id, tr.tierId, tr.qty - 1)}
                                className={stepper}
                              >
                                <Minus size={16} strokeWidth={2} aria-hidden />
                              </button>
                              <span className="tnum w-6 text-center text-[16px] font-semibold">{tr.qty}</span>
                              <button
                                type="button"
                                aria-label={t("booking.increaseQty", { name: tr.tierName })}
                                onClick={() => setQty(line.id, tr.tierId, tr.qty + 1)}
                                className={stepper}
                              >
                                <Plus size={16} strokeWidth={2} aria-hidden />
                              </button>
                            </>
                          )}
                          <span className="tnum w-24 shrink-0 text-right text-[15px] font-semibold">{formatMoney(tr.price * tr.qty)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="flex items-baseline justify-between border-t border-hairline pt-comfortable text-[15px] font-semibold">
                    <span>{t("basket.lineSubtotal")}</span>
                    <span className="tnum">{formatMoney(lineSubtotal(line))}</span>
                  </p>
                </li>
              );
            })}
          </ul>

          <aside className="rounded-[20px] border border-line bg-white p-major shadow-[0_12px_40px_rgba(0,0,0,0.06)] lg:sticky lg:top-24">
            <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{t("checkout.summaryTitle")}</h2>
            <div className="mt-section flex flex-col gap-tight">
              <Row label={t("basket.subtotal")} value={formatMoney(flow.totals.subtotal)} />
              {flow.totals.taxTotal > 0 && <Row label={t("basket.vat")} value={formatMoney(flow.totals.taxTotal)} />}
              <Row label={t("basket.total")} value={formatMoney(flow.totals.total)} strong />
            </div>
            <button type="button" className={`${sfBtn.primary} mt-major w-full`} onClick={flow.goCheckout}>
              {t("basket.continue")}
            </button>
            <p className="mt-section flex items-start gap-tight text-[14px] text-muted">
              <ShieldCheck size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--sf-ink)]" aria-hidden />
              {t("trust.instantBody")}
            </p>
          </aside>
        </div>
      )}
    </StorefrontChrome>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <p className={strong ? "mt-tight flex items-baseline justify-between border-t border-hairline pt-section text-[20px] font-semibold" : "flex items-baseline justify-between text-[15px] text-muted"}>
      <span>{label}</span>
      <span className={`tnum ${strong ? "" : "text-fg"}`}>{value}</span>
    </p>
  );
}
