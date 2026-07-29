"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Tabs, useToast } from "@/components/ui";
import {
  updateProduct,
  type BookingTypeCode,
  type Category,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
} from "@/lib/api";
import { BookingSetup, type BookingSetupResult } from "./BookingSetup";
import { emptyTier, PriceTiersField, type FormTier } from "./PriceTiersField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";

const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const minorToMajor = (m: number) => (m / 100).toFixed(2);
const numOrUndef = (s: string) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : undefined; };

// Plain-language summary from a stored code — the operator never sees the code.
function bookingSummary(code: BookingTypeCode): string {
  switch (code) {
    case "BT-01": return "Visitors can come any time — no date needed.";
    case "BT-02": return "Visitors pick a date. No daily limit.";
    case "BT-06": return "Visitors pick a date, capped per day. Once full, that date stops selling.";
    case "BT-03": return "Visitors pick a date and time. Runs at set start times.";
    case "BT-09": return "Visitors pick a date and time. A guide runs each departure.";
    default: return "Booking setup configured.";
  }
}

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  booking: BookingSetupResult;
  active: boolean;
  counter: boolean;
  online: boolean;
  locationIds: string[];
  maxPerOrder: string;
  minAge: string;
  tiers: FormTier[];
  images: FormImage[];
}

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    description: p.description,
    categoryId: p.categoryId ?? "",
    booking: { bookingType: p.bookingType, summary: bookingSummary(p.bookingType), validityDays: p.validityDays },
    active: p.status !== "inactive",
    counter: p.channels.includes("counter"),
    online: p.channels.includes("online"),
    locationIds: p.locationIds,
    maxPerOrder: p.maxPerOrder != null ? String(p.maxPerOrder) : "",
    minAge: p.minAge != null ? String(p.minAge) : "",
    tiers: p.tiers.map((t) => ({ id: t.id, name: t.name, price: minorToMajor(t.price), maxPerOrder: t.maxPerOrder != null ? String(t.maxPerOrder) : "", active: t.active })),
    images: p.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
  };
}

const TABS = [
  { value: "details", label: "Details" },
  { value: "availability", label: "Availability" },
  { value: "pricing", label: "Pricing" },
  { value: "where", label: "Where it's sold" },
  { value: "advanced", label: "Advanced" },
];

export function ProductForm({
  product,
  categories,
  locations,
  currency = "BDT",
}: {
  product: Product;
  categories: Category[];
  locations: Location[];
  currency?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo(() => fromProduct(product), [product]);
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");

  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));
  const toggleLocation = (id: string) =>
    set("locationIds", state.locationIds.includes(id) ? state.locationIds.filter((x) => x !== id) : [...state.locationIds, id]);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const channels: Channel[] = [];
    if (state.counter) channels.push("counter");
    if (state.online) channels.push("online");
    const input: Partial<ProductInput> = {
      name: state.name,
      description: state.description,
      images: state.images.map(({ id, url, alt }) => ({ id, url, alt })),
      categoryId: state.categoryId || null,
      bookingType: state.booking.bookingType,
      tiers: state.tiers.map((t) => ({ id: t.id, name: t.name, price: majorToMinor(t.price), maxPerOrder: numOrUndef(t.maxPerOrder), active: t.active })),
      locationIds: state.locationIds,
      channels,
      status: state.active ? "active" : "inactive",
      maxPerOrder: numOrUndef(state.maxPerOrder),
      minAge: numOrUndef(state.minAge),
      validityDays: state.booking.validityDays,
    };
    const res = await updateProduct(product.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success("Changes saved.");
      setState(fromProduct(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      setTab("pricing");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div className="rounded-md border border-neutral-200 bg-white p-major">
        {tab === "details" && (
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label="Name" required value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} className="sm:col-span-2" />
            <FormField label="Description" variant="textarea" value={state.description} onChange={(e) => set("description", e.target.value)} className="sm:col-span-2" />
            <FormField label="Category" variant="select" value={state.categoryId} onChange={(e) => set("categoryId", e.target.value)} options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            <div className="sm:col-span-2"><ImageUploadField images={state.images} onChange={(images) => set("images", images)} /></div>
          </div>
        )}

        {tab === "availability" && (
          <div className="flex flex-col gap-section">
            <div>
              <p className="type-label mb-tight text-[12px] text-neutral-600">When people can use it</p>
              <BookingSetup value={state.booking} onChange={(b) => b && set("booking", b)} />
            </div>
            <div className="grid gap-section sm:grid-cols-2">
              <FormField label="Max per order" variant="number" value={state.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value)} />
              <FormField label="Minimum age" variant="number" value={state.minAge} onChange={(e) => set("minAge", e.target.value)} />
              <FormField label="On sale" variant="toggle" checked={state.active} onChange={(e) => set("active", (e.target as HTMLInputElement).checked)} help="Turn off to hide from sale." />
            </div>
          </div>
        )}

        {tab === "pricing" && <PriceTiersField tiers={state.tiers} onChange={(tiers) => set("tiers", tiers)} errors={errors} currency={currency} />}

        {tab === "where" && (
          <div className="grid gap-section sm:grid-cols-2">
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-neutral-600">Where it&apos;s sold</span>
              <FormField label="At the counter" variant="toggle" checked={state.counter} onChange={(e) => set("counter", (e.target as HTMLInputElement).checked)} />
              <FormField label="Online" variant="toggle" checked={state.online} onChange={(e) => set("online", (e.target as HTMLInputElement).checked)} />
            </div>
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-neutral-600">Locations</span>
              {locations.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-tight text-sm">
                  <input type="checkbox" checked={state.locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} className="h-4 w-4 accent-ember" />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {tab === "advanced" && (
          <div className="flex flex-col gap-tight text-sm">
            <p className="text-[13px] text-neutral-400">Internal values for support and debugging. Read-only.</p>
            <AdvancedRow label="Booking type" value={state.booking.bookingType} />
            <AdvancedRow label="Product ID" value={product.id} />
            <AdvancedRow label="Created" value={product.createdAt} />
            <AdvancedRow label="Updated" value={product.updatedAt} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-between border-t border-neutral-200 bg-paper py-section">
        <span className="font-mono text-[12px] text-neutral-400">{dirty ? "Unsaved changes" : "No changes"}</span>
        <div className="flex items-center gap-tight">
          <Button variant="secondary" onClick={() => router.push("/products")} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function AdvancedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-200 py-tight last:border-0">
      <span className="text-neutral-600">{label}</span>
      <span className="font-mono text-[12px]">{value}</span>
    </div>
  );
}
