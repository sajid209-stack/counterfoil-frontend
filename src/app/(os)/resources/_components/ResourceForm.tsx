"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, useToast } from "@/components/ui";
import {
  createResourceRecord,
  updateResource,
  type Location,
  type Resource,
  type ResourceInput,
} from "@/lib/api";

const NOUNS = ["Field", "Court", "Lane", "Room", "Table", "Studio", "Bay"];
const plural = (n: string) => (n.endsWith("s") ? n : `${n}s`);

interface FormState {
  name: string;
  nounSingular: string;
  locationId: string;
  outOfService: boolean;
  outOfServiceReason: string;
  active: boolean;
}

const fromResource = (r: Resource): FormState => ({
  name: r.name,
  nounSingular: r.nounSingular,
  locationId: r.locationId ?? "",
  outOfService: r.outOfService,
  outOfServiceReason: r.outOfServiceReason ?? "",
  active: r.status !== "inactive",
});

export function ResourceForm({
  mode,
  resource,
  locations,
  defaultNoun = "Field",
}: {
  mode: "create" | "edit";
  resource?: Resource;
  locations: Location[];
  defaultNoun?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = useMemo<FormState>(
    () =>
      resource
        ? fromResource(resource)
        : { name: "", nounSingular: defaultNoun, locationId: locations[0]?.id ?? "", outOfService: false, outOfServiceReason: "", active: true },
    [resource, locations, defaultNoun],
  );
  const [state, setState] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(state) !== JSON.stringify(initial), [state, initial]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setState((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    setErrors({});
    const input: ResourceInput = {
      name: state.name,
      nounSingular: state.nounSingular,
      nounPlural: plural(state.nounSingular),
      locationId: state.locationId || null,
      outOfService: state.outOfService,
      outOfServiceReason: state.outOfService ? state.outOfServiceReason || null : null,
      status: state.active ? "active" : "inactive",
    };
    const res = mode === "create" ? await createResourceRecord(input) : await updateResource(resource!.id, input);
    setSaving(false);
    if (res.ok) {
      toast.success(mode === "create" ? `${input.nounSingular} added.` : "Changes saved.");
      if (mode === "create") router.push(`/resources/${res.data.id}`);
      else setState(fromResource(res.data));
    } else if (res.error.code === "validation" && res.error.fieldErrors) {
      setErrors(res.error.fieldErrors);
      toast.error(res.error.message);
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      <div className="rounded-md border border-neutral-200 bg-white p-major">
        <h2 className="type-h2 mb-section text-base">Details</h2>
        <div className="grid gap-section sm:grid-cols-2">
          <FormField label="Name" required placeholder="Field 1" value={state.name} onChange={(e) => set("name", e.target.value)} error={errors.name} />
          <FormField
            label="What is it?"
            variant="select"
            value={state.nounSingular}
            onChange={(e) => set("nounSingular", e.target.value)}
            options={NOUNS.map((n) => ({ value: n, label: n }))}
            help="Used everywhere, including the menu."
          />
          <FormField label="Location" variant="select" value={state.locationId} onChange={(e) => set("locationId", e.target.value)} options={[{ value: "", label: "No location" }, ...locations.map((l) => ({ value: l.id, label: l.name }))]} />
          <FormField label="Active" variant="toggle" checked={state.active} onChange={(e) => set("active", (e.target as HTMLInputElement).checked)} />
        </div>
      </div>

      <div className="rounded-md border border-neutral-200 bg-white p-major">
        <h2 className="type-h2 mb-section text-base">Out of service</h2>
        <FormField
          label={`Take this ${state.nounSingular.toLowerCase()} out of service`}
          variant="toggle"
          checked={state.outOfService}
          onChange={(e) => set("outOfService", (e.target as HTMLInputElement).checked)}
          help="Every product using it stops selling it immediately."
        />
        {state.outOfService && (
          <FormField label="Reason" placeholder="Maintenance / rain" value={state.outOfServiceReason} onChange={(e) => set("outOfServiceReason", e.target.value)} className="mt-section max-w-sm" />
        )}
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-tight border-t border-neutral-200 bg-paper py-section">
        <Button variant="secondary" onClick={() => router.push("/resources")} disabled={saving}>Cancel</Button>
        <Button onClick={save} loading={saving} disabled={!dirty && mode === "edit"}>{mode === "create" ? "Add" : "Save changes"}</Button>
      </div>
    </div>
  );
}
