"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField } from "@/components/ui";
import { updateOperator } from "@/lib/api";

const COUNTRIES = ["Bangladesh", "Malaysia", "United States", "Canada"];
const CURRENCIES = ["BDT", "MYR", "USD", "CAD"];
const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [currency, setCurrency] = useState("BDT");
  const [timezone, setTimezone] = useState("Asia/Dhaka");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError("Enter your business name to continue.");
      return;
    }
    setSaving(true);
    await updateOperator({ name, currency, defaultTimezone: timezone });
    setSaving(false);
    router.push("/dashboard");
  };

  return (
    <div className="w-full max-w-md rounded-md border border-line bg-card p-major">
      <p className="type-label text-[13px] text-ember">Welcome</p>
      <h1 className="type-h1 mt-inline text-2xl">Name your business</h1>
      <p className="type-body mt-tight text-[13px] text-muted">
        This is what guests and your team will see.
      </p>

      <div className="mt-major flex flex-col gap-section">
        <FormField
          label="Business name"
          placeholder="Lalbagh Heritage Attractions"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          error={error}
        />
        <FormField label="Country" variant="select" value={country} onChange={(e) => setCountry(e.target.value)} options={COUNTRIES.map((c) => ({ value: c, label: c }))} />
        <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
          <FormField label="Currency" variant="select" value={currency} onChange={(e) => setCurrency(e.target.value)} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          <FormField label="Timezone" variant="select" value={timezone} onChange={(e) => setTimezone(e.target.value)} options={TIMEZONES.map((t) => ({ value: t, label: t }))} />
        </div>
      </div>

      <Button fullWidth className="mt-major" loading={saving} onClick={submit}>
        Continue
      </Button>
    </div>
  );
}
