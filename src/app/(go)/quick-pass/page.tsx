"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { checkout, listProducts } from "@/lib/api";
import { DEMO_TODAY as TODAY } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { durationOptions, formatDuration, isDealDuration, productDurationPrice } from "@/lib/duration";
import { formatMoney } from "@/lib/format";

// BT-14 — field-issued pass. Quick issue on the spot: duration, price and the
// identifier the product's config asks for ("Plate number"). Not in the grid.
export default function QuickPassPage() {
  const t = useTranslations("quickpass");
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100, filters: { status: "active" } }), []);
  const passProduct = useMemo(() => productsQ.data?.data.find((p) => p.bookingType === "BT-14"), [productsQ.data]);
  const idLabel = passProduct?.passIdentifierLabel || t("identifierFallback");
  const baseMinor = passProduct?.tiers.find((t) => t.active)?.price ?? 10000; // per hour

  /* The pass reads the SAME duration engine the till does. It used to take
     product.flexibleDurations and fall back to a hardcoded [30, 60, 120, 180],
     then price it as base × hours — so an operator who set a 15-minute
     increment, a minimum, or a two-hour deal got none of it here. A pass is a
     span of time sold on a resource like any other; there is no reason for it
     to have its own arithmetic. */
  const cfg = passProduct?.durationConfig;
  const durations = cfg
    ? durationOptions(cfg)
    : (passProduct?.flexibleDurations ?? [30, 60, 120, 180]);

  const [duration, setDuration] = useState(60);
  const [priceEdit, setPriceEdit] = useState<string | null>(null); // null = follow config
  const [identifier, setIdentifier] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [code, setCode] = useState<string | null>(null);

  // Engine price (models, bands and deal prices), still editable — a pass is
  // often written at whatever the manager says.
  const enginePrice = passProduct
    ? productDurationPrice(passProduct, TODAY, "12:00", duration, baseMinor)
    : Math.round((baseMinor * duration) / 60);
  const price = priceEdit ?? String(enginePrice / 100);

  const issue = async () => {
    setIssuing(true);
    const minor = Math.round((parseFloat(price) || 0) * 100);
    const res = await checkout({
      channel: "counter",
      locationId: passProduct?.locationIds[0] ?? "loc_fort",
      counterId: null,
      staffId: null,
      lines: [{ productId: passProduct?.id ?? "quick_pass", productName: `${passProduct?.name ?? t("passFallback")} · ${formatDuration(duration)}`, tierName: identifier || t("passFallback"), admits: 1, quantity: 1, unitPrice: minor, taxRate: 0 }],
      taxPct: 0,
      method: "cash",
      amountTendered: minor,
    });
    setIssuing(false);
    if (res.ok) setCode(res.data.firstTicketCode);
  };

  if (code) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-major px-section py-hero text-center">
        <CircleCheck size={48} strokeWidth={1.5} className="text-success" />
        <h1 className="type-h1 text-2xl">{t("passIssuedTitle")}</h1>
        <div className="w-full rounded-sm bg-inverse px-section py-major"><span className="font-mono text-2xl text-inverse-fg">{code}</span></div>
        <Button size="lg" fullWidth onClick={() => { setCode(null); setIdentifier(""); }}>{t("issueAnother")}</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-section px-section py-hero">
      <div>
        <p className="type-label text-[13px] text-brand-foreground">{t("gateLabel")}</p>
        <h1 className="type-h1 mt-tight text-2xl">{t("title")}</h1>
        <p className="type-body mt-tight text-muted">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-tight">
        <span className="type-label text-[13px] text-muted">{t("duration")}</span>
          {/* The till's stepper, not a row of chips — same control for the same
              decision, and it walks the increment the booking is configured
              with instead of a list this screen invented. */}
          {(() => {
            const i = durations.indexOf(duration);
            const prev = i > 0 ? durations[i - 1] : null;
            const next = i >= 0 && i < durations.length - 1 ? durations[i + 1] : null;
            const pick = (d: number) => { setDuration(d); setPriceEdit(null); };
            return (
              <div className="flex items-center gap-tight">
                <button type="button" aria-label={t("shorter")} disabled={prev == null} onClick={() => prev != null && pick(prev)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-line text-xl disabled:opacity-40 active:bg-ember/10">−</button>
                <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-sm border border-line bg-card py-tight">
                  <span className="text-base font-medium">{formatDuration(duration)}</span>
                  <span className="font-mono text-[13px] text-muted">
                    {formatMoney(enginePrice, "BDT")}
                    {cfg && isDealDuration(cfg, duration) ? ` · ${t("deal")}` : ""}
                  </span>
                </div>
                <button type="button" aria-label={t("longer")} disabled={next == null} onClick={() => next != null && pick(next)} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm border border-line text-xl disabled:opacity-40 active:bg-ember/10">+</button>
              </div>
            );
          })()}
      </div>

      <FormField label={t("priceLabel")} variant="number" value={price} onChange={(e) => setPriceEdit(e.target.value)} help={priceEdit == null ? t("priceHelp") : undefined} />
      <FormField label={idLabel} placeholder={idLabel} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />

      <Button size="lg" fullWidth loading={issuing} onClick={issue}>{t("issuePass", { amount: formatMoney(Math.round((parseFloat(price) || 0) * 100)) })}</Button>
    </main>
  );
}
