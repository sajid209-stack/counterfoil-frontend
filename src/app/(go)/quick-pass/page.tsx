"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck } from "lucide-react";
import { Button, FormField } from "@/components/ui";
import { checkout, listProducts } from "@/lib/api";
import { DEMO_TODAY as TODAY } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { useActiveCounterNow } from "@/lib/activeCounter";
import { durationOptions, formatDuration, isDealDuration, productDurationPrice } from "@/lib/duration";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { GoCard } from "../_components/Tiles";
import { GoPage, GoPageHeader } from "../_components/GoPage";

// BT-14 — field-issued pass. Quick issue on the spot: duration, price and the
// identifier the product's config asks for ("Plate number"). Not in the grid.
export default function QuickPassPage() {
  const t = useTranslations("quickpass");
  const activeCounter = useActiveCounterNow();
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
      locationId: activeCounter.locationId || (passProduct?.locationIds[0] ?? "loc_fort"),
      counterId: activeCounter.counter?.id ?? null,
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
      <GoPage width="narrow">
      <main className="mx-auto flex max-w-104 flex-col gap-comfortable pb-section pt-tight rail:max-w-lg rail:py-0">
        <GoCard className="items-center py-major text-center" bodyClassName="flex flex-col items-center gap-comfortable">
          <CircleCheck size={48} strokeWidth={1.5} aria-hidden className="text-success" />
          <h1 className="text-xl font-semibold tracking-title text-fg">{t("passIssuedTitle")}</h1>
          <span className="break-all font-mono text-2xl text-fg">{code}</span>
        </GoCard>
        <Button size="lg" fullWidth className="h-13 text-md font-semibold" onClick={() => { setCode(null); setIdentifier(""); }}>{t("issueAnother")}</Button>
      </main>
      </GoPage>
    );
  }

  const i = durations.indexOf(duration);
  const prev = i > 0 ? durations[i - 1] : null;
  const next = i >= 0 && i < durations.length - 1 ? durations[i + 1] : null;
  const pickDuration = (d: number) => { setDuration(d); setPriceEdit(null); };
  /* One filled, one quiet: "+" is the stronger move (a longer pass is the
     usual ask), "−" is the quiet way back. */
  const stepBtn = "flex size-14 shrink-0 items-center justify-center rounded-full text-xl disabled:opacity-40";
  const minusCls = cn(stepBtn, "bg-subtle text-muted active:bg-nav-selected");
  const plusCls = cn(stepBtn, "bg-inverse text-inverse-fg");

  return (
    <GoPage width="narrow">
    <div className="mx-auto max-w-104 pb-section pt-tight rail:max-w-none rail:py-0">
      <GoPageHeader title={t("title")} subtitle={t("subtitle")} className="mb-comfortable! rail:mb-major!" />

    {/* Phone: one column. Desktop: how long on the left, the details on the
        right, and the one orange button under them, bottom-right. */}
    <main className="flex flex-col gap-comfortable rail:grid rail:grid-cols-2 rail:items-stretch rail:gap-section">
      <GoCard title={t("duration")}>
        {/* The till's stepper, not a row of chips — same control for the same
            decision, and it walks the increment the booking is configured
            with instead of a list this screen invented. */}
        <div className="flex items-center gap-tight rail:my-auto">
          <button type="button" aria-label={t("shorter")} disabled={prev == null} onClick={() => prev != null && pickDuration(prev)} className={minusCls}>−</button>
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center py-tight">
            <span className="text-lg font-semibold">{formatDuration(duration)}</span>
            {/* The price is stated once, in the field below. */}
            {cfg && isDealDuration(cfg, duration) && <span className="text-sm text-muted">{t("deal")}</span>}
          </div>
          <button type="button" aria-label={t("longer")} disabled={next == null} onClick={() => next != null && pickDuration(next)} className={plusCls}>+</button>
        </div>
      </GoCard>

      <GoCard>
        <FormField label={t("priceLabel")} variant="number" value={price} onChange={(e) => setPriceEdit(e.target.value)} />
        {priceEdit == null && <p className="-mt-tight text-sm text-muted">{t("priceHelp")}</p>}
        <FormField label={`${idLabel} (${t("optional")})`} placeholder={idLabel} value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
      </GoCard>

      <Button size="lg" fullWidth className="h-13 text-md font-semibold rail:col-span-2 rail:ml-auto rail:w-auto rail:min-w-72" loading={issuing} onClick={issue}>{t("issuePass", { amount: formatMoney(Math.round((parseFloat(price) || 0) * 100)) })}</Button>
    </main>
    </div>
    </GoPage>
  );
}
