"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui";
import { Switch } from "@/app/(os)/settings/_components/SettingsKit";
import { hasConsent, setCustomerConsent, type ConsentChannel, type Customer } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Panel } from "./Panel";

const CHANNELS: ConsentChannel[] = ["sms", "email"];

/**
 * Whether they have agreed to be messaged, per channel, as a switch.
 *
 * Every change is appended to the consent log (that is what
 * `setCustomerConsent` does), so flipping a switch is safe to do and the line
 * under it says when it last changed and how — the proof, in one glance,
 * without a history table taking over the page.
 */
export function ConsentCard({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [busy, setBusy] = useState<ConsentChannel | null>(null);

  const toggle = async (channel: ConsentChannel, next: boolean) => {
    setBusy(channel);
    // Recorded by a manager on this screen — the source is part of the proof.
    const res = await setCustomerConsent(customer.id, channel, next, "manager");
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(next ? t("consentGranted") : t("consentWithdrawn"));
    onChanged();
  };

  /** The latest decision for a channel — the log is append-only. */
  const lastFor = (channel: ConsentChannel) =>
    customer.consents
      .filter((c) => c.channel === channel)
      .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))[0];

  return (
    <Panel title={t("consentTitle")}>
      <p className="mb-comfortable text-[0.8125rem] text-muted">{t("consentExplain")}</p>
      <ul className="flex flex-col">
        {CHANNELS.map((channel) => {
          const on = hasConsent(customer, channel);
          const last = lastFor(channel);
          const label = channel === "email" ? t("channelEmail") : t("channelSms");
          const nameId = `consent-${channel}`;
          const stateId = `consent-${channel}-state`;
          return (
            <li key={channel} className="flex items-center justify-between gap-comfortable border-b border-hairline py-tight first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <p id={nameId} className="text-sm font-medium text-fg">
                  {label}
                </p>
                <p id={stateId} className="text-[0.8125rem] text-muted">
                  {last
                    ? t(last.granted ? "consentAgreedOn" : "consentSaidNoOn", {
                        date: formatDate(last.capturedAt),
                        source: t(`source_${last.source}` as "source_counter"),
                      })
                    : t("consentNever")}
                </p>
              </div>
              <Switch
                checked={on}
                disabled={busy === channel}
                labelledBy={nameId}
                describedBy={stateId}
                onChange={(next) => toggle(channel, next)}
              />
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
