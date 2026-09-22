"use client";

import { DurationInput, FormField } from "@/components/ui";
import type { ProductPolicies } from "@/lib/api";

export function policySummary(p: ProductPolicies): string {
  const parts: string[] = [];
  parts.push(p.cancellation === "none" ? "No cancellation" : p.cancellation === "fee" ? `Cancellation fee ${p.cancelFeePct}%` : `Free cancellation until ${p.cancelHours}h before`);
  parts.push(p.deposit === "percent" ? `Partial pay · min ${p.depositPct}% deposit` : "Full payment");
  parts.push(p.reentry === "single" ? "Single entry" : p.reentry === "same_day" ? "Re-entry same day" : "Re-entry while valid");
  if (p.waiver) parts.push("Waiver required");
  return parts.join(" · ");
}

export function PoliciesField({ value, onChange }: { value: ProductPolicies; onChange: (p: ProductPolicies) => void }) {
  const set = <K extends keyof ProductPolicies>(k: K, v: ProductPolicies[K]) => onChange({ ...value, [k]: v });
  const num = (s: string) => parseInt(s, 10) || 0;

  return (
    <div className="flex flex-col gap-major">
      <p className="rounded-sm bg-subtle px-comfortable py-tight text-[13px] text-muted">{policySummary(value)}</p>

      <Section title="Sales window">
        <FormField label="Bookable up to (days ahead)" variant="number" value={String(value.salesWindowDays)} onChange={(e) => set("salesWindowDays", num(e.target.value))} />
        <DurationInput label="Sales cut-off before start" value={value.cutoffMinutes} onChange={(n) => set("cutoffMinutes", n)} chips={[0, 15, 30, 60]} help="Stop selling this long before the session starts." />
      </Section>

      <Section title="Cancellation & reschedule">
        <FormField label="Cancellation" variant="select" value={value.cancellation} onChange={(e) => set("cancellation", e.target.value as ProductPolicies["cancellation"])} options={[{ value: "none", label: "Not allowed" }, { value: "free_until", label: "Free until N hours" }, { value: "fee", label: "Fee" }]} />
        {value.cancellation === "free_until" && <DurationInput label="Free until before start" value={value.cancelHours * 60} step={60} onChange={(n) => set("cancelHours", Math.round(n / 60))} chips={[12 * 60, 24 * 60, 48 * 60]} />}
        {value.cancellation === "fee" && <FormField label="Cancellation fee (%)" variant="number" value={String(value.cancelFeePct)} onChange={(e) => set("cancelFeePct", num(e.target.value))} />}
        <FormField label="Reschedule" variant="select" value={value.reschedule} onChange={(e) => set("reschedule", e.target.value as ProductPolicies["reschedule"])} options={[{ value: "none", label: "Not allowed" }, { value: "until", label: "Allowed until N hours" }]} />
        {value.reschedule === "until" && <DurationInput label="Reschedule until before start" value={value.rescheduleHours * 60} step={60} onChange={(n) => set("rescheduleHours", Math.round(n / 60))} chips={[12 * 60, 24 * 60, 48 * 60]} />}
      </Section>

      <Section title="Entry & payment">
        <FormField label="Re-entry" variant="select" value={value.reentry} onChange={(e) => set("reentry", e.target.value as ProductPolicies["reentry"])} options={[{ value: "single", label: "Single entry" }, { value: "same_day", label: "Re-entry same day" }, { value: "while_valid", label: "Re-entry while valid" }]} />
        <FormField label="Payment" variant="select" value={value.deposit} onChange={(e) => set("deposit", e.target.value as ProductPolicies["deposit"])} options={[{ value: "full", label: "Full payment only" }, { value: "percent", label: "Allow partial payment" }]} help="Partial: the customer pays a deposit now and settles the balance later (at the counter or on arrival)." />
        {value.deposit === "percent" && <FormField label="Minimum deposit (%)" variant="number" value={String(value.depositPct)} onChange={(e) => set("depositPct", num(e.target.value))} help="The least that must be collected up front. The cashier can take more, up to the full amount." />}
      </Section>

      <Section title="Party size">
        <FormField label="Minimum" variant="number" value={String(value.partyMin)} onChange={(e) => set("partyMin", num(e.target.value))} />
        <FormField label="Maximum" variant="number" value={String(value.partyMax)} onChange={(e) => set("partyMax", num(e.target.value))} />
      </Section>

      <Section title="Waiver">
        <FormField label="Requires waiver acknowledgement at sale" variant="toggle" checked={!!value.waiver} onChange={(e) => set("waiver", (e.target as HTMLInputElement).checked)} help='POS asks "Guest has signed the waiver" before adding to a sale.' />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label mb-tight text-[12px] text-muted">{title}</p>
      <div className="grid gap-section sm:grid-cols-2">{children}</div>
    </div>
  );
}
