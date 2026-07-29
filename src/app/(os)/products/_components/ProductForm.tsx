"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  ConfirmDialog,
  FormField,
  useToast,
} from "@/components/ui";
import {
  createProduct,
  updateProduct,
  type BookingTypeCode,
  type Category,
  type Channel,
  type Location,
  type Product,
  type ProductInput,
} from "@/lib/api";
import {
  emptyTier,
  PriceTiersField,
  type FormTier,
} from "./PriceTiersField";
import { ImageUploadField, type FormImage } from "./ImageUploadField";

const BOOKING_TYPES: BookingTypeCode[] = ["BT-01", "BT-02", "BT-03", "BT-06", "BT-09"];

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  bookingType: BookingTypeCode;
  active: boolean;
  counter: boolean;
  online: boolean;
  locationIds: string[];
  maxPerOrder: string;
  minAge: string;
  validityDays: string;
  tiers: FormTier[];
  images: FormImage[];
}

const majorToMinor = (s: string): number => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const minorToMajor = (m: number): string => (m / 100).toFixed(2);
const numOrUndef = (s: string): number | undefined => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
};

function fromProduct(p: Product): FormState {
  return {
    name: p.name,
    description: p.description,
    categoryId: p.categoryId ?? "",
    bookingType: p.bookingType,
    active: p.status !== "inactive",
    counter: p.channels.includes("counter"),
    online: p.channels.includes("online"),
    locationIds: p.locationIds,
    maxPerOrder: p.maxPerOrder != null ? String(p.maxPerOrder) : "",
    minAge: p.minAge != null ? String(p.minAge) : "",
    validityDays: p.validityDays != null ? String(p.validityDays) : "",
    tiers: p.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      price: minorToMajor(t.price),
      maxPerOrder: t.maxPerOrder != null ? String(t.maxPerOrder) : "",
      active: t.active,
    })),
    images: p.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
  };
}

const blank: FormState = {
  name: "",
  description: "",
  categoryId: "",
  bookingType: "BT-01",
  active: true,
  counter: true,
  online: false,
  locationIds: [],
  maxPerOrder: "",
  minAge: "",
  validityDays: "",
  tiers: [emptyTier()],
  images: [],
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-neutral-200 bg-white p-major">
      <h2 className="type-h2 mb-section text-base">{title}</h2>
      {children}
    </section>
  );
}

export function ProductForm({
  mode,
  product,
  categories,
  locations,
  currency = "BDT",
}: {
  mode: "create" | "edit";
  product?: Product;
  categories: Category[];
  locations: Location[];
  currency?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const initial = useMemo(
    () => (product ? fromProduct(product) : blank),
    [product],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(state) !== JSON.stringify(initial),
    [state, initial],
  );

  // Warn on browser navigation away with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const toInput = (): ProductInput => {
    const channels: Channel[] = [];
    if (state.counter) channels.push("counter");
    if (state.online) channels.push("online");
    return {
      name: state.name,
      description: state.description,
      images: state.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
      categoryId: state.categoryId || null,
      bookingType: state.bookingType,
      tiers: state.tiers.map((t) => ({
        id: t.id,
        name: t.name,
        price: majorToMinor(t.price),
        maxPerOrder: numOrUndef(t.maxPerOrder),
        active: t.active,
      })),
      locationIds: state.locationIds,
      channels,
      status: state.active ? "active" : "inactive",
      maxPerOrder: numOrUndef(state.maxPerOrder),
      minAge: numOrUndef(state.minAge),
      validityDays: numOrUndef(state.validityDays),
    };
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input = toInput();
    const res =
      mode === "create"
        ? await createProduct(input)
        : await updateProduct(product!.id, input);
    setSaving(false);

    if (res.ok) {
      toast.success(mode === "create" ? "Product created." : "Changes saved.");
      if (mode === "create") router.push(`/products/${res.data.id}`);
      else setState(fromProduct(res.data)); // reset dirty baseline
      return;
    }
    if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  const cancel = () => {
    if (dirty) setConfirmDiscard(true);
    else router.push("/products");
  };

  const toggleLocation = (id: string) =>
    set(
      "locationIds",
      state.locationIds.includes(id)
        ? state.locationIds.filter((x) => x !== id)
        : [...state.locationIds, id],
    );

  return (
    <div className="flex flex-col gap-section pb-hero">
      <Section title="Details">
        <div className="grid gap-section sm:grid-cols-2">
          <FormField
            label="Name"
            required
            placeholder="Fort General Admission"
            value={state.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            className="sm:col-span-2"
          />
          <FormField
            label="Description"
            variant="textarea"
            placeholder="What the guest is buying…"
            value={state.description}
            onChange={(e) => set("description", e.target.value)}
            className="sm:col-span-2"
          />
          <FormField
            label="Category"
            variant="select"
            value={state.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            options={[
              { value: "", label: "Uncategorised" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <FormField
            label="Booking type"
            variant="select"
            value={state.bookingType}
            onChange={(e) => set("bookingType", e.target.value as BookingTypeCode)}
            options={BOOKING_TYPES.map((b) => ({ value: b, label: b }))}
            help="Drives booking behaviour. Not shown to guests."
          />
        </div>
      </Section>

      <Section title="Pricing">
        <PriceTiersField
          tiers={state.tiers}
          onChange={(tiers) => set("tiers", tiers)}
          errors={errors}
          currency={currency}
        />
      </Section>

      <Section title="Availability">
        <div className="grid gap-section sm:grid-cols-2">
          <div className="flex flex-col gap-tight">
            <span className="type-label text-[12px] text-neutral-600">Sales channels</span>
            <FormField
              label="Counter"
              variant="toggle"
              checked={state.counter}
              onChange={(e) => set("counter", (e.target as HTMLInputElement).checked)}
            />
            <FormField
              label="Online"
              variant="toggle"
              checked={state.online}
              onChange={(e) => set("online", (e.target as HTMLInputElement).checked)}
            />
          </div>
          <div className="flex flex-col gap-tight">
            <span className="type-label text-[12px] text-neutral-600">Locations</span>
            {locations.map((loc) => (
              <label key={loc.id} className="flex cursor-pointer items-center gap-tight text-sm">
                <input
                  type="checkbox"
                  checked={state.locationIds.includes(loc.id)}
                  onChange={() => toggleLocation(loc.id)}
                  className="h-4 w-4 accent-ember"
                />
                {loc.name}
              </label>
            ))}
          </div>
          <FormField
            label="Max per order"
            variant="number"
            placeholder="—"
            value={state.maxPerOrder}
            onChange={(e) => set("maxPerOrder", e.target.value)}
          />
          <FormField
            label="Minimum age"
            variant="number"
            placeholder="—"
            value={state.minAge}
            onChange={(e) => set("minAge", e.target.value)}
          />
          <FormField
            label="Validity (days)"
            variant="number"
            placeholder="—"
            value={state.validityDays}
            onChange={(e) => set("validityDays", e.target.value)}
            help="Used by pass/validity-window types."
          />
          <FormField
            label="Active"
            variant="toggle"
            checked={state.active}
            onChange={(e) => set("active", (e.target as HTMLInputElement).checked)}
            help="Inactive products are hidden from sale."
          />
        </div>
      </Section>

      <Section title="Images">
        <ImageUploadField images={state.images} onChange={(images) => set("images", images)} />
      </Section>

      <div className="sticky bottom-0 flex items-center justify-between gap-tight border-t border-neutral-200 bg-paper py-section">
        <span className="font-mono text-[12px] text-neutral-400">
          {dirty ? "Unsaved changes" : "No changes"}
        </span>
        <div className="flex items-center gap-tight">
          <Button variant="secondary" onClick={cancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => router.push("/products")}
        title="Discard changes?"
        message="Your unsaved changes will be lost."
        confirmLabel="Discard"
      />
    </div>
  );
}
