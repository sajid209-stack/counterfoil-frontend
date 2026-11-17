"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, PageShell, useToast } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { addPeriod, issueMembership, listMembershipTiers, resolveCustomer, type Customer, type MembershipMember } from "@/lib/api";
import { DetailsStep } from "./DetailsStep";
import { PlanStep } from "./PlanStep";
import { WhoStep } from "./WhoStep";

/** Add a member: who, which plan, the details. One page, answered in place. */
export function NewMember() {
  const t = useTranslations("membershipDetail.new");
  const tm = useTranslations("memberships");
  const ts = useTranslations("membershipsList.shared");
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();

  // `undefined` = nothing chosen yet, so the address's ?customer= / ?plan= apply.
  const [pickedCustomer, setPickedCustomer] = useState<Customer | null | undefined>(undefined);
  const [pickedPlan, setPickedPlan] = useState<string | undefined>(undefined);
  const [start, setStart] = useState<string>(DEMO_TODAY);
  const [people, setPeople] = useState<MembershipMember[] | null>(null);
  const [saving, setSaving] = useState(false);

  const tiersQ = useApiQuery(() => listMembershipTiers({ pageSize: 50 }), []);
  const tiers = (tiersQ.data?.data ?? []).filter((x) => x.status === "active");

  const customer = pickedCustomer === undefined ? resolveCustomer(params.get("customer")) : (pickedCustomer ?? undefined);
  const planId = pickedPlan ?? params.get("plan");
  const tier = tiers.find((x) => x.id === planId);

  const max = tier?.maxMembers ?? 1;
  const seats: MembershipMember[] = Array.from({ length: max }, (_, i) => people?.[i] ?? (i === 0 ? { name: customer?.name ?? "" } : { name: "" }));

  const ready = !!customer && !!tier;
  const endText = !tier ? "" : tier.billingPeriod === "lifetime" ? ts("forLife") : formatDate(addPeriod(start, tier.billingPeriod));

  const submit = async () => {
    if (!customer || !tier) return;
    setSaving(true);
    const named = max > 1 ? seats.map((p) => ({ name: p.name.trim(), note: p.note?.trim() || undefined })).filter((p) => p.name) : undefined;
    const res = await issueMembership({ customerId: customer.id, tierId: tier.id, members: named, startedAt: start });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("bar.added", { name: customer.name }));
    router.push(`/memberships/${res.data.id}`);
  };

  return (
    <PageShell title={t("title")} back={{ href: "/memberships", label: tm("title") }}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-section">
        <WhoStep
          customer={customer}
          onPick={(c) => {
            setPickedCustomer(c);
            setPeople(null);
          }}
        />
        <PlanStep tiers={tiers} loading={tiersQ.loading && !tiersQ.data} value={tier?.id ?? null} onChange={setPickedPlan} />
        <DetailsStep start={start} onStart={setStart} max={max} people={seats} onPeople={setPeople} />

        <div className="sticky bottom-section z-10 max-md:bottom-[calc(82px+env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center justify-between gap-tight rounded-card border border-line bg-card px-section py-tight shadow-float">
            <div className="min-w-0">
              <p className="break-words text-base font-medium text-fg">
                {ready ? t("bar.sentence", { plan: tier.name, name: customer.name, price: formatMoney(tier.price), date: endText }) : t("bar.empty")}
              </p>
              <p className="text-sm text-muted">{t("bar.payment")}</p>
            </div>
            <div className="flex shrink-0 gap-tight">
              <Button variant="secondary" onClick={() => router.push("/memberships")} disabled={saving}>
                {tm("cancel")}
              </Button>
              <Button onClick={submit} loading={saving} disabled={!ready}>
                {t("bar.submit")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
