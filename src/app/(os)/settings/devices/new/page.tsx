"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button, FormField, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createDevice, listCounters, type Device } from "@/lib/api";

export default function NewDevicePage() {
  const router = useRouter();
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const counters = countersQ.data?.data ?? [];

  const [name, setName] = useState("");
  const [counterId, setCounterId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Device | null>(null);

  const register = async () => {
    setSaving(true);
    setError("");
    const res = await createDevice({ name, counterId: counterId || null, status: "active" });
    setSaving(false);
    if (res.ok) setCreated(res.data);
    else if (res.error.fieldErrors?.name) setError(res.error.fieldErrors.name);
    else setError(res.error.message);
  };

  return (
    <PageShell title="Register a device" description="Name the tablet and pair it to a counter.">
      <Link href="/settings/devices" className="mb-section inline-flex items-center gap-inline text-[13px] text-neutral-400 hover:text-ink">
        <ArrowLeft size={14} strokeWidth={1.5} /> Devices
      </Link>

      {created ? (
        <div className="max-w-md rounded-md border border-neutral-200 bg-white p-major text-center">
          <p className="type-label text-[13px] text-ember">Device registered</p>
          <h2 className="type-h2 mt-tight text-lg">{created.name}</h2>
          <p className="type-body mt-section text-[13px] text-neutral-600">Enter this pairing code on the tablet to connect it.</p>
          <div className="mt-section rounded-sm bg-neutral-900 px-section py-major">
            <span className="font-mono text-3xl text-paper">{created.pairingCode}</span>
          </div>
          <div className="mt-major flex justify-center gap-tight">
            <Button variant="secondary" onClick={() => { setCreated(null); setName(""); setCounterId(""); }}>Register another</Button>
            <Button onClick={() => router.push("/dashboard")}>Done</Button>
          </div>
        </div>
      ) : (
        <div className="max-w-md rounded-md border border-neutral-200 bg-white p-major">
          <div className="flex flex-col gap-section">
            <FormField label="Device name" required placeholder="Fort iPad 3" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} error={error} />
            <FormField label="Counter" variant="select" value={counterId} onChange={(e) => setCounterId(e.target.value)} options={[{ value: "", label: "Pair later" }, ...counters.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <Button className="mt-major" onClick={register} loading={saving}>Get pairing code</Button>
        </div>
      )}
    </PageShell>
  );
}
