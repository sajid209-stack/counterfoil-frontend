"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Notice, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  deviceReadiness,
  formatPairingCode,
  newPairingCode,
  pairingNow,
  peekDevices,
  type Counter,
  type Device,
  type Location,
  type Staff,
} from "@/lib/api";

/**
 * The code, the three steps to use it, and a live answer to "did it work?".
 *
 * The code is the one thing in this flow that is read here and typed somewhere
 * else, so it is set large, with the steps beside it. Below it a status line
 * watches the device (every second, from the store) and changes from "Waiting
 * for the tablet…" to "Paired ✓ — Fort iPad 3 is ready at Fort Main Gate" the
 * moment the tablet pairs, so a manager standing at the screen does not have to
 * guess or reload.
 *
 * Used twice: right after a device is added, and on a device's own page while
 * it is still waiting for its tablet.
 */
export function PairingPanel({
  device: initial,
  staff,
  counters,
  locations,
  onChange,
  onDone,
}: {
  device: Device;
  staff: Staff[];
  counters: Counter[];
  locations: Location[];
  /** Called whenever the device changes (a tablet paired, a new code issued). */
  onChange?: (device: Device) => void;
  onDone: () => void;
}) {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const [device, setDevice] = useState(initial);
  const [now, setNow] = useState(() => pairingNow());
  const [busy, setBusy] = useState(false);
  /** A new code was just issued: said under the code, not as a toast that would follow the manager to the next screen. */
  const [fresh, setFresh] = useState(false);
  const onChangeRef = useRef(onChange);
  const latest = useRef(initial);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const take = (next: Device) => {
    latest.current = next;
    setDevice(next);
    onChangeRef.current?.(next);
  };

  // Watch the store: the tablet pairs through the api, which replaces the row.
  useEffect(() => {
    const tick = () => {
      setNow(pairingNow());
      const fresh = peekDevices().find((d) => d.id === initial.id);
      if (fresh && fresh !== latest.current) {
        latest.current = fresh;
        setDevice(fresh);
        onChangeRef.current?.(fresh);
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [initial.id]);

  const counter = counters.find((c) => c.id === device.counterId);
  const venue = locations.find((l) => l.id === counter?.locationId);
  const r = deviceReadiness(device, staff, now);
  const code = formatPairingCode(device.pairingCode);
  const paired = r.pairing === "paired";
  const expired = r.pairing === "expired";
  const minutes = device.pairingExpiresAt ? Math.ceil((Date.parse(device.pairingExpiresAt) - now.getTime()) / 60_000) : 0;

  const showNew = async () => {
    setBusy(true);
    const res = await newPairingCode(device.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    take(res.data);
    setFresh(true);
  };

  const state = paired ? (r.ready ? "paired" : "stuck") : expired ? "expired" : "waiting";

  return (
    <section aria-label={t("devices.codeLabel")} className="card-surface p-card" data-testid="pairing-panel">
      <p className="text-sm font-medium text-muted">{t("devices.codeLabel")}</p>
      <p
        data-testid="pairing-code"
        data-code={device.pairingCode}
        className={cn(
          "mt-tight select-all font-mono text-display font-medium leading-none tracking-[0.12em] text-fg sm:text-[56px]", // ds-exception: the pairing code is read here and typed on another screen, so it is set large
          (paired || expired) && "text-muted line-through decoration-1",
        )}
      >
        {code}
      </p>
      {fresh && !paired && (
        <p role="status" data-testid="pairing-fresh" className="mt-inline text-sm font-medium text-success">
          {t("devices.newCodeToast")}
        </p>
      )}
      {!paired && (
        <p className={cn("mt-tight text-sm", expired ? "font-medium text-warning" : "text-muted")} data-testid="pairing-expiry">
          {expired ? t("devices.codeExpired") : minutes <= 1 ? t("devices.codeExpiresSoon") : t("devices.codeExpires", { min: minutes })}
        </p>
      )}

      <ol className="mt-major flex flex-col gap-tight">
        {(["step1", "step2", "step3"] as const).map((step, i) => (
          <li key={step} className="flex items-start gap-comfortable text-base text-fg">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted ring-1 ring-inset ring-hairline"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">{t(`devices.${step}`)}</span>
          </li>
        ))}
      </ol>

      <div aria-live="polite" data-testid="pair-status" data-state={state} className="mt-major">
        <Notice
          tone={state === "paired" ? "success" : state === "waiting" ? "neutral" : "warning"}
          icon={
            state === "waiting" ? (
              <span className="flex h-4.5 w-4.5 items-center justify-center">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember-solid" />
              </span>
            ) : undefined
          }
        >
          <span className="font-medium">
            {state === "paired"
              ? t("devices.statusPaired", { name: device.name, counter: counter?.name ?? "" })
              : state === "stuck"
                ? t("devices.statusPairedStuck")
                : state === "expired"
                  ? t("devices.codeExpired")
                  : t("devices.statusWaiting")}
          </span>
        </Notice>
      </div>
      {state === "paired" && venue && (
        <p className="mt-inline text-sm text-muted">{t("devices.readyCount", { count: r.canSignIn.length })}</p>
      )}

      <div className="mt-major flex flex-wrap items-center gap-tight">
        <Button onClick={onDone}>{t("devices.done")}</Button>
        {!paired && (
          <Button variant="secondary" onClick={showNew} loading={busy}>
            {t("devices.newCode")}
          </Button>
        )}
        {!paired && !expired && (
          <Button
            variant="secondary"
            onClick={() => router.push(`/login/pair?code=${encodeURIComponent(device.pairingCode)}`)}
            title={t("devices.pairHereNote")}
          >
            {t("devices.pairHere")}
          </Button>
        )}
      </div>
      {!paired && !expired && <p className="mt-tight text-sm text-muted">{t("devices.pairHereNote")}</p>}
    </section>
  );
}
