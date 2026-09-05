"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, FormField, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createDevice, listCounters, type Device } from "@/lib/api";

export default function NewDevicePage() {
  const router = useRouter();
  const t = useTranslations("settings");
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
    <PageShell title={t("devices.newTitle")} description={t("devices.newDescription")}>
      <Link href="/settings/devices" className="mb-section inline-flex items-center gap-inline text-[13px] text-faint hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("devices.backToDevices")}
      </Link>

      {created ? (
        <div className="max-w-md card-surface p-major text-center">
          <p className="type-label text-[13px] text-brand-foreground">{t("devices.registered")}</p>
          <h2 className="type-h2 mt-tight text-lg">{created.name}</h2>
          <p className="type-body mt-section text-[13px] text-muted">{t("devices.pairInstruction")}</p>
          <div className="mt-section rounded-sm bg-neutral-900 px-section py-major">
            <span className="font-mono text-3xl text-inverse-fg">{created.pairingCode}</span>
          </div>
          <div className="mt-major flex justify-center gap-tight">
            <Button variant="secondary" onClick={() => { setCreated(null); setName(""); setCounterId(""); }}>{t("devices.registerAnother")}</Button>
            <Button onClick={() => router.push("/dashboard")}>{t("devices.done")}</Button>
          </div>
        </div>
      ) : (
        <div className="max-w-md card-surface p-major">
          <div className="flex flex-col gap-section">
            <FormField label={t("devices.deviceName")} required placeholder={t("devices.deviceNamePlaceholder")} value={name} onChange={(e) => { setName(e.target.value); setError(""); }} error={error} />
            <FormField label={t("devices.counter")} variant="select" value={counterId} onChange={(e) => setCounterId(e.target.value)} options={[{ value: "", label: t("devices.pairLater") }, ...counters.map((c) => ({ value: c.id, label: c.name }))]} />
          </div>
          <Button className="mt-major" onClick={register} loading={saving}>{t("devices.getPairingCode")}</Button>
        </div>
      )}
    </PageShell>
  );
}
