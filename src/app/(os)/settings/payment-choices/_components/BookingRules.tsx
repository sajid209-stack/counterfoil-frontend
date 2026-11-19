"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { Button, Modal, ProductThumb, Sheet, useToast } from "@/components/ui";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { updateProduct } from "@/lib/api";
import type { PayNowRule, Product } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { SearchField, SettingsSection, Switch } from "../../_components/SettingsKit";
import { RuleEditor } from "./RuleEditor";
import { isValid, toDraft, toRule, type RuleDraft } from "./ruleDraft";

const SEARCH_AFTER = 8;

/** A rule in words: "Full or minimum (50%)". */
export function useRuleWords(currency: string) {
  const t = useTranslations("moneysetup.payNow");
  return (rule: PayNowRule) => {
    const base = t(`short.${rule.options}`);
    if (rule.options === "full" || rule.minValue <= 0) return base;
    const min = rule.minKind === "percent" ? `${rule.minValue}%` : formatMoney(rule.minValue, currency);
    return t("withMin", { answer: base, min });
  };
}

/**
 * Every active booking with the answer it sells under now — the business
 * default, or a rule of its own — and an editor opened from the row.
 */
export function BookingRules({
  products,
  defaultRule,
  currency,
  symbol,
  onSaved,
}: {
  products: Product[];
  defaultRule: PayNowRule;
  currency: string;
  symbol: string;
  onSaved: () => void;
}) {
  const t = useTranslations("moneysetup.payNow");
  const words = useRuleWords(currency);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);

  const q = query.trim().toLowerCase();
  const shown = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

  return (
    <SettingsSection title={t("perBooking.title")} description={t("perBooking.description")}>
      {products.length > SEARCH_AFTER && (
        <div className="px-card pb-comfortable">
          <SearchField value={query} onChange={setQuery} label={t("perBooking.search")} placeholder={t("perBooking.search")} />
        </div>
      )}
      {shown.length === 0 ? (
        <p className="px-card py-section text-sm text-muted">{products.length === 0 ? t("perBooking.empty") : t("perBooking.noMatch")}</p>
      ) : (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {shown.map((p) => {
            const own = !!p.payNow;
            const answer = words(p.payNow ?? defaultRule);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={t("perBooking.edit", { name: p.name })}
                  className="flex min-h-14 w-full items-center gap-comfortable px-card py-tight text-left transition-colors duration-quick hover:bg-muted-wash"
                >
                  <ProductThumb images={p.images} name={p.name} bookingType={p.bookingType} size="chip" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-fg">{p.name}</span>
                    <span className="mt-inline block text-sm leading-relaxed text-muted">
                      {t(own ? "ownAnswer" : "defaultAnswer", { answer })}
                    </span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <BookingRuleEditor
          key={editing.id}
          product={editing}
          defaultRule={defaultRule}
          currency={currency}
          symbol={symbol}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onSaved();
          }}
        />
      )}
    </SettingsSection>
  );
}

function BookingRuleEditor({
  product,
  defaultRule,
  currency,
  symbol,
  onClose,
  onSaved,
}: {
  product: Product;
  defaultRule: PayNowRule;
  currency: string;
  symbol: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("moneysetup.payNow");
  const tc = useTranslations("common");
  const toast = useToast();
  const wide = useMediaQuery(MD);
  const words = useRuleWords(currency);
  const [useDefault, setUseDefault] = useState(!product.payNow);
  const [draft, setDraft] = useState<RuleDraft>(toDraft(product.payNow ?? defaultRule));
  const [saving, setSaving] = useState(false);
  const labelId = useId();

  const invalid = !useDefault && !isValid(draft);

  const save = async () => {
    if (invalid) return;
    const rule = useDefault ? undefined : toRule(draft, product.payNow ?? defaultRule);
    setSaving(true);
    const res = await updateProduct(product.id, { payNow: rule ?? undefined });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("editor.saved", { name: product.name }));
    onSaved();
  };

  const title = t("editor.title", { name: product.name });
  const body = (
    <div className="flex flex-col gap-section">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-major">
        <div className="min-w-0">
          <p id={labelId} className="text-base font-medium text-fg">
            {t("editor.useDefault")}
          </p>
          <p className="mt-inline text-sm leading-relaxed text-muted">{t("editor.useDefaultHelp", { answer: words(defaultRule) })}</p>
        </div>
        <Switch checked={useDefault} onChange={setUseDefault} labelledBy={labelId} />
      </div>
      {!useDefault && <RuleEditor draft={draft} onChange={setDraft} currency={currency} symbol={symbol} name={`rule-${product.id}`} />}
    </div>
  );
  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>
        {t("editor.cancel")}
      </Button>
      <Button onClick={save} loading={saving} disabled={invalid}>
        {t("editor.save")}
      </Button>
    </>
  );

  return wide ? (
    <Modal open onClose={onClose} title={title} footer={footer}>
      {body}
    </Modal>
  ) : (
    <Sheet open onClose={onClose} title={title} closeLabel={tc("close")} footer={<div className="flex w-full gap-tight [&>*]:flex-1">{footer}</div>}>
      {/* The kit Sheet leaves its body's padding to the caller. */}
      <div className="px-gutter py-section">{body}</div>
    </Sheet>
  );
}
