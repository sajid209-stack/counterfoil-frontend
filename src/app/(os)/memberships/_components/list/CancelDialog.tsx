"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, ChoiceCard, FormField, Modal, useToast } from "@/components/ui";
import { cancelMembership, pauseMembership, setMembershipAutoRenew, type MembershipView } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Choice = "stop" | "now";

/**
 * Cancel a membership (docs/memberships.md 4.2): the gentler choice first.
 * Stop renewing keeps access until the end date; Cancel now ends it today and
 * needs a reason. Pause is offered as a line, because a cancel cannot be undone.
 */
export function CancelDialog({ membership, onClose, onDone }: { membership: MembershipView | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("membershipsList");
  const toast = useToast();
  const [picked, setPicked] = useState<Choice>("stop");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const m = membership;
  // With renewing already off, there is only one way left to end it.
  const choice: Choice = m && !m.autoRenew ? "now" : picked;
  const date = formatDate(m?.expiresAt);

  const reset = () => {
    setPicked("stop");
    setReason("");
    setError(undefined);
  };
  const close = () => {
    reset();
    onClose();
  };
  const finish = (message: string) => {
    toast.success(message);
    reset();
    onDone();
  };

  const submit = async () => {
    if (!m) return;
    setSaving(true);
    if (choice === "stop") {
      const res = await setMembershipAutoRenew(m.id, false);
      setSaving(false);
      if (!res.ok) return toast.error(t("toast.failed"));
      return finish(t("toast.stopped", { date }));
    }
    const res = await cancelMembership(m.id, reason);
    setSaving(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    finish(t("toast.cancelled"));
  };

  const pause = async () => {
    if (!m) return;
    setSaving(true);
    const res = await pauseMembership(m.id);
    setSaving(false);
    if (!res.ok) return toast.error(t("toast.failed"));
    finish(t("toast.paused"));
  };

  const options: { value: Choice; title: string; body: string }[] = [
    { value: "stop", title: t("cancel.stopTitle"), body: t("cancel.stopBody", { date }) },
    { value: "now", title: t("cancel.nowTitle"), body: t("cancel.nowBody") },
  ];

  return (
    <Modal
      open={!!m}
      onClose={close}
      title={t("cancel.title", { name: m?.customerName ?? "" })}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t("cancel.keep")}
          </Button>
          <Button variant={choice === "now" ? "destructive" : "primary"} onClick={submit} loading={saving}>
            {choice === "now" ? t("cancel.confirmNow") : t("cancel.confirmStop")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        {m?.autoRenew ? (
          <div role="group" aria-label={t("cancel.choices")} className="flex flex-col gap-tight">
            {options.map((o) => (
              <ChoiceCard key={o.value} selected={choice === o.value} onClick={() => setPicked(o.value)} className="flex flex-col gap-inline p-comfortable">
                <span className="pr-section text-base font-semibold text-fg">{o.title}</span>
                <span className="text-sm text-muted">{o.body}</span>
              </ChoiceCard>
            ))}
          </div>
        ) : (
          m && <p className="text-sm text-muted">{t("cancel.nowBody")}</p>
        )}
        {choice === "now" && (
          <FormField
            label={t("cancel.reason")}
            variant="textarea"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(undefined);
            }}
            help={t("cancel.reasonHelp")}
            error={error}
          />
        )}
        {m?.effectiveStatus === "active" && (
          <p className="text-sm text-muted">
            {t("cancel.pausePrompt")}{" "}
            <button type="button" onClick={pause} disabled={saving} className="text-fg underline underline-offset-4 hover:no-underline">
              {t("cancel.pauseLink")}
            </button>
          </p>
        )}
      </div>
    </Modal>
  );
}
