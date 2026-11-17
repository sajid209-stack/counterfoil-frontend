"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, Modal, RadioGroup } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { MembershipView } from "@/lib/api";

export type CancelChoice = "stop" | "now";

/**
 * Cancel, the gentle way first. "Stop renewing" keeps access until the end
 * date; "Cancel now" ends it today and needs a reason. Pause is offered as a
 * line, because it is what someone going away for a while actually wants.
 * Mount it only while open, so each opening starts fresh.
 */
export function CancelDialog({
  membership,
  busy,
  onClose,
  onStopRenewing,
  onCancelNow,
  onPause,
}: {
  membership: MembershipView;
  busy: boolean;
  onClose: () => void;
  onStopRenewing: () => void;
  onCancelNow: (reason: string) => void;
  onPause: () => void;
}) {
  const t = useTranslations("membershipDetail.cancel");
  const tm = useTranslations("memberships");
  const canStop = membership.autoRenew && membership.effectiveStatus !== "lapsed";
  const canPause = membership.effectiveStatus === "active";
  const [picked, setPicked] = useState<CancelChoice | null>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const choice: CancelChoice = picked ?? (canStop ? "stop" : "now");
  const missing = choice === "now" && !reason.trim();

  const confirm = () => {
    if (choice === "stop") return onStopRenewing();
    if (missing) return setTouched(true);
    onCancelNow(reason);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("title", { name: membership.customerName })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {tm("keepIt")}
          </Button>
          <Button variant={choice === "now" ? "destructive" : "primary"} onClick={confirm} loading={busy}>
            {choice === "now" ? t("confirmNow") : t("confirmStop")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        {canStop && (
          <RadioGroup
            aria-label={t("choose")}
            value={choice}
            onChange={(v) => setPicked(v as CancelChoice)}
            options={[
              { value: "stop", label: t("stopTitle"), description: t("stopBody", { date: formatDate(membership.expiresAt) }) },
              { value: "now", label: t("nowTitle"), description: t("nowBody") },
            ]}
          />
        )}
        {!canStop && <p className="text-base text-fg">{t("nowBody")}</p>}

        {choice === "now" && (
          <FormField
            variant="textarea"
            label={tm("cancelReason")}
            help={tm("cancelReasonHelp")}
            required
            rows={3}
            value={reason}
            error={touched && missing ? tm("cancelReason") : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
        )}

        {canPause && (
          <div className="flex flex-wrap items-center justify-between gap-tight border-t border-hairline pt-section">
            <p className="min-w-0 text-sm text-muted">{t("pauseLine")}</p>
            <Button size="sm" variant="secondary" onClick={onPause} disabled={busy}>
              {t("pauseInstead")}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
