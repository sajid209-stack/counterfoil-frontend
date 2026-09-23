"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { levelOf, recordMovement, recordReturn, stocktakeTo, type InventoryItemView, type Location } from "@/lib/api";

export type StockAction = "receive" | "count" | "remove" | "back";

/**
 * Moving the count, with the reason attached.
 *
 * Three actions rather than one "adjust by ±n", because those are the three
 * things that actually happen to a cupboard and each asks for a different
 * number: a delivery arrives (how many came), somebody counts the shelf (what
 * is there now — not the difference, which is arithmetic the operator should
 * never have to do), and something is broken, lost or written off (how many
 * went, and what happened to them).
 *
 * The reason is required on every one of them. A stock correction with no
 * explanation is indistinguishable from a bug six weeks later — the rule holds
 * and booking locks already follow, and the ledger is the only record there is.
 */
export function StockDialog({
  item,
  action,
  locations,
  actor,
  onClose,
  onDone,
}: {
  item: InventoryItemView;
  action: StockAction;
  locations: Location[];
  actor: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("inventory");
  const kept = locations.filter((l) => item.locationIds.includes(l.id));
  const [locationId, setLocationId] = useState(kept[0]?.id ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  /** Which kind of loss — the reason field says the rest. */
  const [loss, setLoss] = useState<"damaged" | "lost">("damaged");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const here = levelOf(item.id, locationId);
  const n = parseInt(qty, 10);
  /* Zero is a legitimate COUNT — "there are none left" is the most important
     stocktake there is — and not a legitimate quantity for anything else. */
  const valid = Number.isFinite(n) && (action === "count" ? n >= 0 : n > 0);
  /** What the shelf will say afterwards, before anything is written. */
  const after = !valid
    ? null
    : action === "receive"
      ? here.onHand + n
      : action === "count"
        ? n
        : action === "back"
          ? here.onHand + n
          : here.onHand - n;

  const submit = async () => {
    if (busy) return;
    const e: Record<string, string> = {};
    if (!valid) e.quantity = t("dialog.needQty");
    /* A return needs no typed reason: the loan is the reason, and asking for
       a sentence per hire is how a desk stops recording them. */
    if (action !== "back" && !reason.trim()) e.reason = t("dialog.needReason");
    if (!locationId) e.locationId = t("dialog.needVenue");
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const res =
      action === "count"
        ? await stocktakeTo(item.id, locationId, n, actor, reason.trim())
        : action === "back"
        ? await recordReturn(item.id, locationId, n, actor)
        : await recordMovement({
            itemId: item.id,
            locationId,
            kind: action === "receive" ? "received" : loss,
            quantity: action === "receive" ? n : -n,
            reason: reason.trim(),
            by: actor,
          });
    setBusy(false);
    if (!res.ok) {
      /* The api names this field `quantity`; the dialog used to read `qty`,
         so every quantity-level refusal — including "that is what the count
         already says" — rendered nothing at all and the dialog just sat
         there. */
      setErrors(res.error.fieldErrors ?? { quantity: res.error.message });
      return;
    }
    onDone(
      t(action === "receive" ? "dialog.received" : action === "count" ? "dialog.counted" : action === "back" ? "dialog.cameBack" : "dialog.removed", {
        count: n,
        unit: item.unit,
        name: item.name,
      }),
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t(`dialog.${action}Title`, { name: item.name })}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button size="sm" loading={busy} onClick={() => void submit()}>
            {t(`dialog.${action}Do`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-comfortable">
        {kept.length > 1 && (
          <label className="flex flex-col gap-inline">
            <span className="type-label text-[12px] text-muted">{t("dialog.venue")}</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="h-11 rounded-sm border border-line bg-card px-comfortable text-[13px] outline-none focus:border-inverse md:h-9"
            >
              {kept.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {action === "remove" && (
          <div className="flex flex-col gap-inline">
            <span className="type-label text-[12px] text-muted">{t("dialog.whatHappened")}</span>
            <div className="flex gap-tight">
              {(["damaged", "lost"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={loss === k}
                  onClick={() => setLoss(k)}
                  className={cn(
                    "min-h-11 flex-1 rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                    loss === k ? "border-inverse bg-inverse text-inverse-fg" : "border-line hover:border-strong",
                  )}
                >
                  {t(`move.${k}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <FormField
          label={t(action === "count" ? "dialog.countedLabel" : "dialog.qtyLabel", { unit: item.unit })}
          variant="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          error={errors.quantity}
          help={t("dialog.nowHere", { count: here.onHand, unit: item.unit })}
        />

        {action !== "back" && (
        <FormField
          label={t("dialog.reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
          placeholder={t(`dialog.reasonPlaceholder.${action}`)}
          help={t("dialog.reasonHelp")}
        />
        )}

        {/* What the shelf will say, before anything is written. A count is the
            one number an operator can check against the real world, so the
            screen states it rather than making them work it out. */}
        {after !== null && (
          <p className="rounded-sm bg-subtle px-comfortable py-tight text-[13px]">
            {t("dialog.after", { count: after, unit: item.unit })}
          </p>
        )}
      </div>
    </Modal>
  );
}
