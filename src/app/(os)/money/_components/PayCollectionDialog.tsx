"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import { payFeeCollection, type FeeCollection } from "@/lib/api";

const METHODS: { key: "payCard" | "payBkash" | "payBank"; icon: LucideIcon }[] = [
  { key: "payBkash", icon: Smartphone },
  { key: "payCard", icon: CreditCard },
  { key: "payBank", icon: Landmark },
];

/**
 * Paying a collection — the billing checkout (SSLCommerz) in the real system.
 *
 * The amount is on the button, not only in the body: the press that moves
 * money says how much. One choice to make, pre-selected to bKash, which is how
 * most operators here pay a bill.
 */
export function PayCollectionDialog({ collection: c, onClose, onPaid }: { collection: FeeCollection | null; onClose: () => void; onPaid: () => void }) {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  const toast = useToast();
  const [method, setMethod] = useState<(typeof METHODS)[number]["key"]>("payBkash");
  const [busy, setBusy] = useState(false);

  const pay = async () => {
    if (!c) return;
    setBusy(true);
    const res = await payFeeCollection(c.id, t(`collections.${method}`));
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("collections.paidToast", { number: c.number }));
    onPaid();
  };

  return (
    <Modal
      open={!!c}
      onClose={onClose}
      title={c ? t("collections.payTitle", { number: c.number }) : ""}
      description={c ? t("collections.payBody", { count: c.count, from: formatDay(c.periodFrom), to: formatDay(c.periodTo) }) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{tc("cancel")}</Button>
          <Button loading={busy} onClick={pay}>{c ? t("collections.pay", { amount: formatMoney(c.amount) }) : ""}</Button>
        </>
      }
    >
      {c && (
        <div role="radiogroup" aria-label={t("collections.payWith")} className="flex flex-col gap-tight">
          <p className="text-[13px] font-medium text-fg">{t("collections.payWith")}</p>
          {METHODS.map(({ key, icon: Icon }) => (
            <label
              key={key}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-comfortable rounded-sm border px-comfortable py-tight text-sm transition-colors duration-quick has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ember",
                method === key ? "border-ember-solid bg-ember/5 font-medium" : "border-line hover:bg-muted-wash",
              )}
            >
              <input type="radio" name="pay-method" checked={method === key} onChange={() => setMethod(key)} className="h-4 w-4 accent-ember" />
              <Icon size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
              {t(`collections.${key}`)}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
