"use client";

import { useTranslations } from "next-intl";
import type { Location, Operator, TaxConfig } from "@/lib/api";

/*
 * The top and bottom of a receipt, drawn once.
 *
 * The printed receipt and the preview in Settings → Business profile both use
 * these, so what an operator sees while typing a footer is what the paper says —
 * a preview built separately is a preview that drifts the first time one of the
 * two is changed.
 */

export function ReceiptHeader({
  operator,
  place,
  tax,
  children,
}: {
  operator: Pick<Operator, "name" | "contactPhone" | "website">;
  /** Where the sale was made — a business with three venues prints the one the customer stood in. */
  place?: Pick<Location, "name" | "addressLine1" | "city"> | null;
  tax?: Pick<TaxConfig, "taxName" | "registrationNumber" | "showOnReceipts"> | null;
  children?: React.ReactNode;
}) {
  const t = useTranslations("ticket");
  const address = place ? [place.name, [place.addressLine1, place.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") : "";
  const contact = [operator.contactPhone, operator.website].filter(Boolean).join(" · ");
  const reg =
    tax?.showOnReceipts && tax.registrationNumber ? t("taxReg", { name: tax.taxName || "VAT", number: tax.registrationNumber }) : "";
  return (
    <div className="mb-section text-center">
      <p className="type-h2 break-words text-base">{operator.name}</p>
      {address && <p className="mt-inline break-words text-[12px] text-muted">{address}</p>}
      {contact && <p className="break-words text-[12px] text-muted">{contact}</p>}
      {reg && <p className="break-words text-[12px] text-muted">{reg}</p>}
      {children}
    </div>
  );
}

export function ReceiptFooter({ message }: { message?: string }) {
  const t = useTranslations("ticket");
  const text = message?.trim();
  return (
    <>
      {text && <p className="mt-major whitespace-pre-line break-words text-center text-[13px] leading-relaxed text-fg">{text}</p>}
      <p className="mt-major text-center font-mono text-[12px] text-muted">{t("poweredBy")}</p>
    </>
  );
}
