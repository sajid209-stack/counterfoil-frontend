"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";
import { setActiveCounter } from "@/lib/activeCounter";
import { setThisDevice, resolveThisDevice, useThisDeviceId } from "@/lib/thisDevice";
import { useApiQuery } from "@/lib/useApi";
import {
  formatPairingCode,
  listCounters,
  listDevices,
  listLocations,
  listStaff,
  pairDevice,
  peopleAllowedOn,
  whoCanSignInOn,
  type Counter,
  type Device,
  type Location,
  type Staff,
} from "@/lib/api";

/**
 * Pair this tablet — the other half of "Add device" in the back office.
 *
 * A manager adds the tablet in Settings, Devices and gets a six-digit code. It
 * is typed here, once. From then on this browser knows which device it is, so
 * the sign-in lists only the people allowed on THIS tablet, and the till
 * stands at the counter the manager chose for it.
 *
 * It lives under /login/ on purpose: the shell draws sign-in screens bare (no
 * tab bar, no cart, nobody's initial), by route, and an unpaired tablet must
 * not be one tap from Sell. `/pair` redirects here.
 */
export default function PairPage() {
  return (
    <Suspense fallback={null}>
      <PairScreen />
    </Suspense>
  );
}

const MAX_NAMES = 6;

function PairScreen() {
  const t = useTranslations("pos");
  const router = useRouter();
  const params = useSearchParams();
  // The code arrives in the address when "Pair on this browser" was pressed in OS.
  const [code, setCode] = useState(() => formatPairingCode(params.get("code") ?? ""));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState<Device | null>(null);

  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 200 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const thisId = useThisDeviceId();
  const already = paired ? undefined : resolveThisDevice(devicesQ.data?.data ?? [], thisId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await pairDevice(code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.code ?? res.error.message);
      return;
    }
    // Remember which device this browser is, and put the till at its counter.
    setThisDevice(res.data.id);
    if (res.data.counterId) setActiveCounter(res.data.counterId);
    setPaired(res.data);
  };

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center bg-surface px-section py-major text-fg">
      <div className="w-full max-w-md">
        {paired ? (
          <Done
            device={paired}
            counters={countersQ.data?.data ?? []}
            locations={locationsQ.data?.data ?? []}
            staff={staffQ.data?.data ?? []}
            loading={!countersQ.data || !locationsQ.data || !staffQ.data}
            onGo={() => router.push("/login")}
          />
        ) : (
          <>
            <h1 className="text-center text-2xl font-semibold leading-tight">{t("pair.title")}</h1>
            <p className="mt-tight text-center text-md text-muted">{t("pair.intro")}</p>

            {already && (
              <p
                className="mt-section card-surface px-section py-tight text-center text-sm text-muted"
                data-testid="pair-already"
              >
                {t("pair.alreadyAs", { name: already.name })}
              </p>
            )}

            <form onSubmit={submit} className="mt-major flex flex-col gap-section" noValidate>
              <div>
                <label htmlFor="pair-code" className="block text-md font-medium text-fg">
                  {t("pair.codeLabel")}
                </label>
                <input
                  id="pair-code"
                  data-testid="pair-code"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    if (error) setError("");
                  }}
                  inputMode="numeric"
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={9}
                  placeholder={t("pair.codePlaceholder")}
                  aria-invalid={!!error || undefined}
                  aria-describedby={error ? "pair-error" : "pair-hint"}
                  // ds-exception: a spaced-out pairing code is read character by character; 0.18em has no scale token
                  className={`mt-tight h-16 w-full rounded-card border bg-card px-section text-center font-mono text-4xl font-medium tracking-[0.18em] text-fg placeholder:text-muted ${error ? "border-danger" : "border-line"}`}
                />
                {error ? (
                  <p id="pair-error" role="alert" data-testid="pair-error" className="mt-tight text-base font-medium text-danger">
                    {error}
                  </p>
                ) : (
                  <p id="pair-hint" className="mt-tight text-sm text-muted">
                    {t("pair.hint")}
                  </p>
                )}
              </div>
              <Button type="submit" size="lg" fullWidth className="h-13 text-md font-semibold" loading={busy} data-testid="pair-submit">
                {busy ? t("pair.pairing") : t("pair.button")}
              </Button>
            </form>

            <p className="mt-major text-center">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center px-section text-base font-medium text-muted underline underline-offset-4 active:text-fg"
              >
                {t("pair.backToSignIn")}
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function Done({
  device,
  counters,
  locations,
  staff,
  loading,
  onGo,
}: {
  device: Device;
  counters: Counter[];
  locations: Location[];
  staff: Staff[];
  loading: boolean;
  onGo: () => void;
}) {
  const t = useTranslations("pos");
  const counter = counters.find((c) => c.id === device.counterId);
  const venue = locations.find((l) => l.id === counter?.locationId);
  const people = whoCanSignInOn(device, staff);
  const noPin = peopleAllowedOn(device, staff).length - people.length;
  const names = people.slice(0, MAX_NAMES).map((s) => s.name);
  return (
    <div data-testid="pair-done" className="flex flex-col items-center text-center">
      <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-success-wash text-success">
        <Check size={28} strokeWidth={2.25} />
      </span>
      <h1 className="mt-section text-2xl font-semibold leading-tight">{t("pair.successTitle")}</h1>
      <p className="mt-tight text-md text-muted">{t("pair.successLine", { name: device.name })}</p>

      <dl className="card-surface mt-major w-full overflow-hidden text-left">
        {[
          { k: "counter", label: t("pair.counter"), value: counter?.name ?? "—" },
          { k: "venue", label: t("pair.venue"), value: venue?.name ?? "—" },
        ].map((row) => (
          <div key={row.k} className="flex items-baseline justify-between gap-section border-b border-line px-section py-comfortable">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd data-testid={`pair-${row.k}`} className="min-w-0 text-right text-md font-medium text-fg">
              {row.value}
            </dd>
          </div>
        ))}
        <div className="px-section py-comfortable">
          <dt className="text-sm text-muted">{t("pair.who")}</dt>
          <dd data-testid="pair-who" className="mt-inline text-md font-medium text-fg">
            {loading ? (
              "…"
            ) : names.length === 0 ? (
              <span className="text-warning">{t("pair.whoNone")}</span>
            ) : (
              <>
                {names.join(", ")}
                {people.length > MAX_NAMES && (
                  <span className="font-normal text-muted"> {t("pair.more", { count: people.length - MAX_NAMES })}</span>
                )}
              </>
            )}
          </dd>
          {!loading && noPin > 0 && names.length > 0 && (
            <p className="mt-inline text-sm text-warning">{t("pair.noPin", { count: noPin })}</p>
          )}
        </div>
      </dl>

      <Button size="lg" fullWidth className="mt-major h-13 text-md font-semibold" onClick={onGo} data-testid="pair-go">
        {t("pair.goSignIn")}
      </Button>
    </div>
  );
}
