"use client";

import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { AffixInput, Button, FormField, Notice, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/useApi";
import { listCustomers, matchOrCreateCustomer, membershipsFor, type Customer } from "@/lib/api";
import { MemberAvatar } from "../shared";
import { StepCard } from "./StepCard";

/** Step 1: find a customer, or add one on the spot. */
export function WhoStep({ customer, onPick }: { customer: Customer | undefined; onPick: (c: Customer | null) => void }) {
  const t = useTranslations("membershipDetail.new.who");
  const tc = useTranslations("common");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const results = useApiQuery(() => listCustomers({ search: query.trim().toLowerCase(), pageSize: 6 }), [query]);
  const rows = results.data?.data ?? [];

  const current = customer ? membershipsFor(customer.id).find((m) => m.effectiveStatus === "active") : undefined;

  const create = async () => {
    setSaving(true);
    const res = await matchOrCreateCustomer({ name, phone });
    setSaving(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.name ?? res.error.message);
      return;
    }
    toast.success(t("added", { name: res.data.name }));
    setAdding(false);
    setName("");
    setPhone("");
    setError(undefined);
    onPick(res.data);
  };

  return (
    <StepCard n={1} title={t("title")} description={t("description")}>
      {customer ? (
        <div className="flex flex-col gap-comfortable">
          <div role="group" aria-label={t("chosen")} className="flex items-center gap-comfortable rounded-card border border-line bg-subtle p-comfortable">
            <MemberAvatar name={customer.name} />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-base font-medium text-fg">{customer.name}</span>
              {customer.phone && <span className="block text-sm text-muted">{customer.phone}</span>}
            </span>
            <Button size="sm" variant="secondary" onClick={() => onPick(null)}>
              {t("change")}
            </Button>
          </div>
          {current && (
            <Notice tone="info" action={{ label: t("view"), href: `/memberships/${current.id}` }}>
              {t("already", { name: customer.name, plan: current.tierName, date: formatDate(current.expiresAt) })}
            </Notice>
          )}
        </div>
      ) : adding ? (
        <div className="flex flex-col gap-comfortable">
          <FormField label={t("name")} required value={name} error={error} autoComplete="off" onChange={(e) => setName(e.target.value)} />
          <FormField label={t("phone")} variant="tel" value={phone} autoComplete="off" onChange={(e) => setPhone(e.target.value)} />
          <div className="flex justify-end gap-tight">
            <Button variant="secondary" onClick={() => setAdding(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={create} loading={saving} disabled={!name.trim()}>
              {t("add")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-comfortable">
          <AffixInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("search")}
            placeholder={t("search")}
            prefix={<Search size={16} strokeWidth={1.5} aria-hidden />}
          />
          {results.loading && !results.data ? (
            <div aria-busy="true" className="flex flex-col gap-tight">
              <Skeleton h={52} />
              <Skeleton h={52} />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">{t("none")}</p>
          ) : (
            <ul className="flex flex-col gap-tight">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-comfortable rounded-card border border-line bg-card p-comfortable text-left",
                      "transition-colors duration-quick hover:border-strong hover:bg-muted-wash",
                    )}
                  >
                    <MemberAvatar name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-medium text-fg">{c.name}</span>
                      {c.phone && <span className="block text-sm text-muted">{c.phone}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <Button size="sm" variant="tertiary" icon={<UserPlus size={16} strokeWidth={1.5} aria-hidden />} onClick={() => { setName(query.trim()); setAdding(true); }}>
              {t("newCustomer")}
            </Button>
          </div>
        </div>
      )}
    </StepCard>
  );
}
