"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { History, Landmark, Smartphone, type LucideIcon } from "lucide-react";
import { Button, ConfirmDialog, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDay } from "@/lib/format";
import { useApiQuery } from "@/lib/useApi";
import {
  CREDENTIAL_FIELDS,
  GATEWAY_PROVIDERS,
  clearGatewayCredentials,
  effectiveCollects,
  getPaymentSettings,
  getPlatformFeeRates,
  listCollectorAccounts,
  listCollectorChanges,
  listLocations,
  percentLabel,
  setGatewayCredentials,
  setLocationOverride,
  switchCollector,
  type Collects,
  type GatewayProvider,
  type Location,
  type PaymentCollectorAccount,
} from "@/lib/api";
import { SettingsSection, controlCls } from "../../_components/SettingsKit";

const PROVIDER_ICON: Record<GatewayProvider, LucideIcon> = { bkash: Smartphone, sslcommerz: Landmark };

type Pending =
  | { kind: "switch"; locationId: string | null; provider: GatewayProvider; to: Collects }
  | { kind: "keys"; locationId: string | null; provider: GatewayProvider; thenSwitch: boolean }
  | { kind: "removeKeys"; locationId: string | null; provider: GatewayProvider }
  | { kind: "follow"; location: Location };

/**
 * Payment accounts — whose account online payments go into, and so which way
 * Counterfoil's fee runs.
 *
 * Each option carries its own terms in the words of the bill it produces: the
 * rates come from the API, the cadence from the payout schedule. A choice that
 * changes how a venue is paid is confirmed in a dialog that says what it does
 * NOT do — it does not reach back into payments already taken — because that
 * is the question everybody asks next.
 *
 * Only bKash and SSLCommerz can be the tenant's own. Stripe is not offered: the
 * backend refuses own-key Stripe, and a choice that cannot be made is not shown.
 */
export function PaymentAccounts() {
  const t = useTranslations("money");
  const tc = useTranslations("common");
  const toast = useToast();
  const accountsQ = useApiQuery(() => listCollectorAccounts(), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const ratesQ = useApiQuery(() => getPlatformFeeRates(), []);
  const settingsQ = useApiQuery(() => getPaymentSettings(), []);
  const historyQ = useApiQuery(() => listCollectorChanges(), []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({});

  const accounts = accountsQ.data ?? [];
  const locations = locationsQ.data?.data ?? [];
  const rates = ratesQ.data;
  const schedule = settingsQ.data?.payoutSchedule ?? "daily";
  const cadence = t(schedule === "daily" ? "settings.cadenceDaily" : schedule === "weekly" ? "settings.cadenceWeekly" : "settings.cadenceMonthly");
  const account = (locationId: string | null, p: GatewayProvider) => accounts.find((a) => a.locationId === locationId && a.provider === p);
  const accountLabel = (c: Collects) => (c === "own" ? t("settings.own") : t("settings.counterfoil"));
  /* Lower-case forms inside a sentence: the option labels are titles, and
     "now go to Your own account" reads as a typo. */
  const accountInline = (c: Collects) => (c === "own" ? t("settings.ownInline") : t("settings.counterfoilInline"));
  const providerName = (p: GatewayProvider) => t(`gatewayProvider.${p}`);

  const reload = () => {
    accountsQ.reload();
    historyQ.reload();
  };

  const choose = (locationId: string | null, provider: GatewayProvider, to: Collects) => {
    const row = account(locationId, provider);
    if (row?.collects === to) return;
    if (to === "own" && !row?.hasOwnCredentials) {
      setKeys({});
      setKeyErrors({});
      setPending({ kind: "keys", locationId, provider, thenSwitch: true });
      return;
    }
    setPending({ kind: "switch", locationId, provider, to });
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    if (pending.kind === "switch") {
      const res = await switchCollector(pending.locationId, pending.provider, pending.to);
      if (res.ok) toast.success(t("settings.switched", { provider: providerName(pending.provider), to: accountInline(pending.to) }));
      else toast.error(res.error.message);
    } else if (pending.kind === "keys") {
      const res = await setGatewayCredentials(pending.locationId, pending.provider, keys);
      if (!res.ok) {
        setBusy(false);
        setKeyErrors(res.error.fieldErrors ?? {});
        return;
      }
      if (pending.thenSwitch) {
        await switchCollector(pending.locationId, pending.provider, "own");
        toast.success(t("settings.switched", { provider: providerName(pending.provider), to: t("settings.ownInline") }));
      } else {
        toast.success(t("settings.keysSaved", { provider: providerName(pending.provider) }));
      }
    } else if (pending.kind === "removeKeys") {
      const res = await clearGatewayCredentials(pending.locationId, pending.provider);
      if (res.ok) toast.success(t("settings.keysRemoved", { provider: providerName(pending.provider) }));
    } else {
      await setLocationOverride(pending.location.id, false);
    }
    setBusy(false);
    setPending(null);
    setKeys({});
    reload();
  };

  const providerRow = (locationId: string | null, provider: GatewayProvider) => {
    const row = account(locationId, provider);
    const current: Collects = locationId === null ? row?.collects ?? "counterfoil" : effectiveCollects(locationId, provider, accounts);
    const Icon = PROVIDER_ICON[provider];
    const name = `${locationId ?? "default"}-${provider}`;
    return (
      <div key={provider} className="flex flex-col gap-comfortable px-card py-section">
        <div className="flex flex-wrap items-center justify-between gap-tight">
          <p className="flex items-center gap-tight text-sm font-medium text-fg">
            <Icon size={16} strokeWidth={1.5} aria-hidden className="text-muted" />
            {providerName(provider)}
          </p>
          <div className="flex flex-wrap items-center gap-tight text-[12px] text-muted">
            <span>{row?.hasOwnCredentials ? t("settings.keysSavedOn", { date: formatDay(row.credentialsSavedAt?.slice(0, 10)) }) : t("settings.noKeys")}</span>
            <Button
              size="sm"
              variant="tertiary"
              onClick={() => {
                setKeys({});
                setKeyErrors({});
                setPending({ kind: "keys", locationId, provider, thenSwitch: false });
              }}
            >
              {row?.hasOwnCredentials ? t("settings.replaceKeys") : t("settings.addKeys")}
            </Button>
            {row?.hasOwnCredentials && (
              <Button size="sm" variant="tertiary" onClick={() => setPending({ kind: "removeKeys", locationId, provider })}>
                {t("settings.removeKeys")}
              </Button>
            )}
          </div>
        </div>
        <div role="radiogroup" aria-label={t("settings.accountsFor", { provider: providerName(provider) })} className="grid gap-tight sm:grid-cols-2">
          {(["counterfoil", "own"] as const).map((c) => {
            const checked = current === c;
            return (
              <label
                key={c}
                className={cn(
                  "flex cursor-pointer items-start gap-comfortable rounded-sm p-comfortable transition-colors duration-quick has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember",
                  checked ? "bg-card ring-2 ring-inset ring-ember-solid" : "bg-muted-wash hover:bg-line/40",
                )}
              >
                <input type="radio" name={name} checked={checked} onChange={() => choose(locationId, provider, c)} className="mt-[3px] h-4 w-4 shrink-0 accent-ember" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-fg">{accountLabel(c)}</span>
                  {rates && (
                    <span className="mt-inline block text-[13px] leading-relaxed text-muted">
                      {c === "counterfoil"
                        ? t("settings.counterfoilDisclosure", { platform: percentLabel(rates.platformFeeBp), gateway: percentLabel(rates.platformGatewayFeeBp), cadence })
                        : t("settings.ownDisclosure", { platform: percentLabel(rates.platformFeeBp) })}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const history = (locationId: string) => {
    const rows = (historyQ.data ?? []).filter((c) => c.locationId === locationId);
    return (
      <details className="group px-card pb-section">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-inline text-[13px] font-medium text-fg md:min-h-9 [&::-webkit-details-marker]:hidden">
          <History size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
          {t("settings.history")} <span className="font-normal text-muted">({rows.length})</span>
        </summary>
        {rows.length === 0 ? (
          <p className="mt-tight text-[13px] text-muted">{t("settings.historyEmpty")}</p>
        ) : (
          <ul className="mt-tight divide-y divide-hairline rounded-sm bg-muted-wash">
            {rows.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-tight px-comfortable py-tight text-[13px]">
                <span className="text-fg">{t("settings.historyRow", { provider: providerName(c.provider), from: accountLabel(c.from), to: accountLabel(c.to) })}</span>
                <span className="text-muted">{t("settings.historyBy", { date: formatDateTime(c.at), who: c.who })}</span>
              </li>
            ))}
          </ul>
        )}
      </details>
    );
  };

  const confirmCopy = (() => {
    if (!pending) return { title: "", message: "", label: "" };
    if (pending.kind === "switch") {
      return {
        title: t("settings.switchTitle", { provider: providerName(pending.provider), to: accountInline(pending.to) }),
        message: t("settings.switchBody", { to: accountInline(pending.to) }),
        label: t("settings.switchConfirm"),
      };
    }
    if (pending.kind === "removeKeys") {
      return { title: `${t("settings.removeKeys")} — ${providerName(pending.provider)}`, message: t("settings.removeKeysBody"), label: t("settings.removeKeys") };
    }
    if (pending.kind === "follow") {
      return {
        title: t("settings.followDefaultTitle", { venue: pending.location.name }),
        message: t("settings.followDefaultBody", { venue: pending.location.name }),
        label: t("settings.followDefaultConfirm"),
      };
    }
    return { title: "", message: "", label: "" };
  })();

  const keysPending = pending?.kind === "keys" ? pending : null;

  return (
    <div id="accounts" className="flex scroll-mt-24 flex-col gap-section">
      <SettingsSection title={t("settings.accountsTitle")} description={t("settings.accountsDesc")}>
        <div className="px-card">
          <p className="text-sm font-semibold text-fg">{t("settings.defaults")}</p>
          <p className="mt-inline text-[13px] text-muted">{t("settings.defaultsDesc")}</p>
        </div>
        <div className="divide-y divide-hairline">{GATEWAY_PROVIDERS.map((p) => providerRow(null, p))}</div>
      </SettingsSection>

      <SettingsSection title={t("settings.perVenue")} description={t("settings.perVenueDesc")}>
        <div className="divide-y divide-hairline">
          {locations.map((l) => {
            const own = accounts.some((a: PaymentCollectorAccount) => a.locationId === l.id);
            return (
              <div key={l.id}>
                <div className="flex flex-col gap-tight px-card pt-section sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-fg">{l.name}</p>
                  <div role="radiogroup" aria-label={l.name} className="inline-flex shrink-0 self-start rounded-sm border border-line bg-card p-[3px]">
                    {([false, true] as const).map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        role="radio"
                        aria-checked={own === v}
                        onClick={async () => {
                          if (own === v) return;
                          if (!v) setPending({ kind: "follow", location: l });
                          else {
                            await setLocationOverride(l.id, true);
                            reload();
                          }
                        }}
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-xs px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                          own === v ? "bg-ember-solid text-white" : "text-muted hover:text-fg",
                        )}
                      >
                        {v ? t("settings.venueOwn") : t("settings.sameAsDefault")}
                      </button>
                    ))}
                  </div>
                </div>
                {own ? (
                  <div className="divide-y divide-hairline">{GATEWAY_PROVIDERS.map((p) => providerRow(l.id, p))}</div>
                ) : (
                  <p className="px-card pb-tight pt-tight text-[13px] text-muted">
                    {GATEWAY_PROVIDERS.map((p) => `${providerName(p)}: ${accountLabel(effectiveCollects(l.id, p, accounts))}`).join(" · ")}
                  </p>
                )}
                {history(l.id)}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={!!pending && pending.kind !== "keys"}
        onClose={() => setPending(null)}
        onConfirm={run}
        loading={busy}
        destructive={pending?.kind === "removeKeys"}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.label}
      />

      <Modal
        open={!!keysPending}
        onClose={() => setPending(null)}
        title={keysPending ? t("settings.keysTitle", { provider: providerName(keysPending.provider) }) : ""}
        description={
          keysPending
            ? `${t("settings.keysBody", { provider: providerName(keysPending.provider) })}${keysPending.thenSwitch ? ` ${t("settings.switchBody", { to: t("settings.ownInline") })}` : ""}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setPending(null)}>{tc("cancel")}</Button>
            <Button loading={busy} onClick={run}>{keysPending?.thenSwitch ? t("settings.keysSaveSwitch") : t("settings.keysSave")}</Button>
          </>
        }
      >
        {keysPending && (
          <form
            className="flex flex-col gap-comfortable"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            {CREDENTIAL_FIELDS[keysPending.provider].map((f) => {
              const secret = /secret|password|passwd/.test(f);
              const id = `key-${f}`;
              return (
                <div key={f}>
                  <label htmlFor={id} className="text-[13px] font-medium text-fg">{t(`settings.field.${f}`)}</label>
                  <input
                    id={id}
                    type={secret ? "password" : "text"}
                    autoComplete={secret ? "new-password" : "off"}
                    spellCheck={false}
                    value={keys[f] ?? ""}
                    onChange={(e) => setKeys((k) => ({ ...k, [f]: e.target.value }))}
                    aria-invalid={!!keyErrors[f] || undefined}
                    className={cn(controlCls(!!keyErrors[f]), "mt-inline font-mono")}
                  />
                  {keyErrors[f] && <p className="mt-inline text-[13px] text-danger">{keyErrors[f]}</p>}
                </div>
              );
            })}
            <button type="submit" tabIndex={-1} aria-hidden className="sr-only">{t("settings.keysSave")}</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
