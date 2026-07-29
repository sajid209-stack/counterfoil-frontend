"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button, FormField, useToast } from "@/components/ui";
import { createProduct, type Category, type Channel, type Location, type ProductInput } from "@/lib/api";
import { BookingSetup, type BookingSetupResult } from "./BookingSetup";
import { emptyTier, PriceTiersField, type FormTier } from "./PriceTiersField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";

const STEPS = ["What you're selling", "When people can use it", "What it costs", "Where it's sold", "Review"];
const majorToMinor = (s: string) => { const n = parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) : 0; };

export function ProductWizard({
  categories,
  locations,
  currency = "BDT",
}: {
  categories: Category[];
  locations: Location[];
  currency?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<FormImage[]>([]);
  const [booking, setBooking] = useState<BookingSetupResult | null>(null);
  const [tiers, setTiers] = useState<FormTier[]>([emptyTier()]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [counter, setCounter] = useState(true);
  const [online, setOnline] = useState(false);

  const canNext =
    step === 0 ? name.trim().length > 0 :
    step === 1 ? booking !== null :
    step === 2 ? tiers.length > 0 && tiers.every((t) => t.name.trim() && t.price !== "") :
    true;

  const toggleLocation = (id: string) =>
    setLocationIds((ls) => (ls.includes(id) ? ls.filter((x) => x !== id) : [...ls, id]));

  const publish = async (asDraft: boolean) => {
    if (!booking) return;
    setSaving(true);
    setErrors({});
    const channels: Channel[] = [];
    if (counter) channels.push("counter");
    if (online) channels.push("online");
    const input: ProductInput = {
      name,
      description,
      images: images.map(({ id, url, alt }) => ({ id, url, alt })),
      categoryId: categoryId || null,
      bookingType: booking.bookingType,
      tiers: tiers.map((t) => ({ id: t.id, name: t.name, price: majorToMinor(t.price), maxPerOrder: t.maxPerOrder ? parseInt(t.maxPerOrder, 10) : undefined, active: t.active })),
      locationIds,
      channels,
      status: asDraft ? "inactive" : "active",
      validityDays: booking.validityDays,
    };
    const res = await createProduct(input);
    setSaving(false);
    if (res.ok) {
      toast.success(asDraft ? "Saved as draft." : "Product published.");
      router.push(`/products/${res.data.id}`);
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      setStep(2);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-major pb-hero">
      {/* Progress */}
      <ol className="flex flex-wrap gap-tight">
        {STEPS.map((label, i) => (
          <li key={label} className={`flex items-center gap-inline rounded-sm px-comfortable py-tight text-[12px] ${i === step ? "bg-ink text-paper" : i < step ? "text-ink" : "text-neutral-400"}`}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current font-mono text-[10px]">
              {i < step ? <Check size={12} strokeWidth={2} /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-md border border-neutral-200 bg-white p-major">
        {step === 0 && (
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label="Name" required placeholder="Fort General Admission" value={name} onChange={(e) => setName(e.target.value)} className="sm:col-span-2" />
            <FormField label="Description" variant="textarea" placeholder="What the guest is buying…" value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
            <FormField label="Category" variant="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
            <div className="sm:col-span-2"><ImageUploadField images={images} onChange={setImages} /></div>
          </div>
        )}

        {step === 1 && <BookingSetup value={booking} onChange={setBooking} />}

        {step === 2 && <PriceTiersField tiers={tiers} onChange={setTiers} errors={errors} currency={currency} />}

        {step === 3 && (
          <div className="grid gap-section sm:grid-cols-2">
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-neutral-600">Where it&apos;s sold</span>
              <FormField label="At the counter" variant="toggle" checked={counter} onChange={(e) => setCounter((e.target as HTMLInputElement).checked)} />
              <FormField label="Online" variant="toggle" checked={online} onChange={(e) => setOnline((e.target as HTMLInputElement).checked)} />
            </div>
            <div className="flex flex-col gap-tight">
              <span className="type-label text-[12px] text-neutral-600">Locations</span>
              {locations.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-tight text-sm">
                  <input type="checkbox" checked={locationIds.includes(l.id)} onChange={() => toggleLocation(l.id)} className="h-4 w-4 accent-ember" />
                  {l.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-section">
            <h2 className="type-h2 text-base">{name || "Untitled product"}</h2>
            <Row label="When">{booking?.summary ?? "—"}</Row>
            <Row label="Price">{tiers.map((t) => `${t.name} ${currency} ${t.price || "0"}`).join(" · ")}</Row>
            <Row label="Where">{[counter && "Counter", online && "Online"].filter(Boolean).join(" · ") || "—"}{locationIds.length ? ` · ${locationIds.length} location(s)` : ""}</Row>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>Continue</Button>
        ) : (
          <div className="flex gap-tight">
            <Button variant="secondary" loading={saving} onClick={() => publish(true)}>Save as draft</Button>
            <Button loading={saving} onClick={() => publish(false)}>Publish</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-section border-b border-neutral-200 pb-tight text-sm last:border-0">
      <span className="w-16 shrink-0 text-neutral-400">{label}</span>
      <span className="flex-1">{children}</span>
    </div>
  );
}
