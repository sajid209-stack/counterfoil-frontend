"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { deviceReadiness, type Device, type Staff } from "@/lib/api";

/**
 * Can this tablet be used? Said in words, as one line per thing that is
 * missing, or as "Ready" with how many people can sign in.
 *
 * A switched-off tablet says nothing here: its own "Off" mark is the answer,
 * and a list of gaps on something nobody expects to work is noise.
 */
export function ReadinessLines({
  device,
  staff,
  className,
}: {
  device: Device;
  staff: Staff[];
  className?: string;
}) {
  const t = useTranslations("settings");
  if (device.status !== "active") return null;
  const r = deviceReadiness(device, staff);
  if (r.ready) {
    return (
      <span className={cn("flex items-center gap-inline font-medium text-success", className)} data-readiness="ready">
        <Check aria-hidden size={14} strokeWidth={2.25} className="shrink-0" />
        <span>
          {t("devices.readyTag")}
          <span className="font-normal text-muted"> · {t("devices.readyCount", { count: r.canSignIn.length })}</span>
        </span>
      </span>
    );
  }
  return (
    <span className={cn("block", className)} data-readiness="gaps" data-gaps={r.gaps.join(" ")}>
      {r.gaps.includes("counter") && <span className="block text-warning">{t("devices.gapCounter")}</span>}
      {r.gaps.includes("pair") && (
        <span className="block text-warning">
          <span className="font-medium">{r.pairing === "expired" ? t("devices.codeExpiredTag") : t("devices.waitingToPair")}</span>
          {" · "}
          <span className="font-medium underline underline-offset-2">{t("devices.showCode")}</span>
        </span>
      )}
      {r.gaps.includes("people") && (
        <span className="block text-warning">
          {r.noPin.length > 0 ? t("devices.gapPeopleNoPin", { count: r.noPin.length }) : t("devices.gapPeopleNobody")}
        </span>
      )}
    </span>
  );
}
