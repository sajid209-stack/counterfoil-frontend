"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { createDevice, listCounters, listLocations, type Device } from "@/lib/api";
import { CreateBar, SectionSkeleton, SettingRow, SettingsSection, controlCls } from "../../_components/SettingsKit";
import { CounterSelect } from "../_components/CounterSelect";

/**
 * Registering a tablet ends where the work actually happens — on the tablet.
 *
 * It used to end with a code in a black box and a Done button that went to the
 * dashboard, a long way from the list the tablet had just joined. The code is
 * the one moment in this flow that has to be read and typed somewhere else, so
 * it is set large with the three steps to use it, and Done returns to Devices.
 */
export default function RegisterDevicePage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const countersQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const [name, setName] = useState("");
  const [counterId, setCounterId] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Device | null>(null);

  const nameErr = touched && !name.trim() ? t("devices.nameRequired") : undefined;

  const register = async () => {
    setSaving(true);
    const res = await createDevice({ name: name.trim(), counterId: counterId || null, status: "active" });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setCreated(res.data);
  };

  if (countersQ.loading || locationsQ.loading) {
    return (
      <PageShell title={t("devices.newTitle")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  if (created) {
    return (
      <PageShell title={t("devices.pairTitle", { name: created.name })} description={t("devices.pairDesc")}>
        <div className="flex max-w-3xl flex-col gap-section pb-hero">
          <section aria-label={t("devices.codeLabel")} className="card-surface p-card">
            <p className="text-[13px] font-medium text-muted">{t("devices.codeLabel")}</p>
            <p className="mt-tight select-all font-mono text-[40px] font-medium leading-none tracking-[0.12em] text-fg">
              {created.pairingCode}
            </p>
            <ol className="mt-major flex flex-col gap-tight">
              {(["step1", "step2", "step3"] as const).map((step, i) => (
                <li key={step} className="flex items-start gap-comfortable text-sm text-fg">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-[12px] font-semibold text-muted ring-1 ring-inset ring-hairline"
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{t(`devices.${step}`)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-major flex flex-wrap gap-tight">
              <Button onClick={() => router.push("/settings/devices")}>{t("devices.done")}</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreated(null);
                  setName("");
                  setCounterId("");
                  setTouched(false);
                }}
              >
                {t("devices.registerAnother")}
              </Button>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("devices.newTitle")} description={t("devices.registerDesc")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("devices.detailsTitle")} description={t("devices.detailsDesc")}>
          <SettingRow label={t("devices.deviceName")} error={nameErr}>
            {({ id, describedBy }) => (
              <input
                id={id}
                value={name}
                placeholder={t("devices.deviceNamePlaceholder")}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                autoComplete="off"
                aria-invalid={!!nameErr || undefined}
                aria-describedby={describedBy}
                className={cn(controlCls(!!nameErr))}
              />
            )}
          </SettingRow>
          <SettingRow label={t("devices.counterLabel")} description={t("devices.counterDescNew")}>
            {({ id, describedBy }) => (
              <CounterSelect
                id={id}
                describedBy={describedBy}
                value={counterId}
                onChange={setCounterId}
                counters={countersQ.data?.data ?? []}
                locations={locationsQ.data?.data ?? []}
              />
            )}
          </SettingRow>
        </SettingsSection>
        <CreateBar
          dirty={!!name || !!counterId}
          invalid={!name.trim()}
          saving={saving}
          note={t("devices.registerNote")}
          invalidNote={t("devices.registerInvalid")}
          submitLabel={t("devices.getPairingCode")}
          onSubmit={register}
          onCancel={() => router.push("/settings/devices")}
        />
      </div>
    </PageShell>
  );
}
