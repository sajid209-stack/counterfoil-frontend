"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  EmptyState,
  FormField,
  Modal,
  StatusPill,
  useToast,
  type PillTone,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  adjustPoints,
  cancelMembership,
  issueMembership,
  listMembershipTiers,
  pauseMembership,
  renewMembership,
  resumeMembership,
  type LoyaltyAccount,
  type MembershipStatus,
  type MembershipView,
} from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";

const MEMBERSHIP_TONE: Record<MembershipStatus, PillTone> = {
  active: "success",
  lapsed: "danger",
  paused: "warning",
  cancelled: "neutral",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-sm border border-line p-comfortable">
      <p className="type-label text-[11px] text-muted">{label}</p>
      <p
        className={`mt-inline font-mono text-lg tabular-nums ${
          tone === "warning" ? "text-warning" : "text-fg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/** What this customer holds and what they have banked (§63.4). */
export function MembershipTab({
  customerId,
  memberships,
  points,
  onChanged,
}: {
  customerId: string;
  memberships: MembershipView[];
  points: LoyaltyAccount;
  onChanged: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [sellOpen, setSellOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (
    id: string,
    run: () => Promise<{ ok: boolean; error?: { message: string } }>,
    message: string,
  ) => {
    setBusy(id);
    const res = await run();
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error?.message ?? "");
      return;
    }
    toast.success(message);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-major">
      <section className="flex flex-col gap-section">
        <div className="flex flex-wrap items-center justify-between gap-tight">
          <h3 className="type-label text-[12px] text-muted">{t("membershipsHeading")}</h3>
          <Button size="sm" variant="secondary" onClick={() => setSellOpen(true)}>
            {t("sellMembership")}
          </Button>
        </div>

        {memberships.length === 0 ? (
          <EmptyState title={t("noMembershipTitle")} message={t("noMembershipMessage")} />
        ) : (
          <ul className="flex flex-col gap-tight">
            {memberships.map((m) => (
              <li key={m.id} className="card-surface p-comfortable">
                <div className="flex flex-wrap items-start justify-between gap-tight">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-tight">
                      <span className="break-words text-sm font-medium">{m.tierName}</span>
                      <StatusPill tone={MEMBERSHIP_TONE[m.effectiveStatus]}>
                        {t(`mstatus_${m.effectiveStatus}` as "mstatus_active")}
                      </StatusPill>
                      {m.expiringSoon && (
                        <StatusPill tone="warning">
                          {t("mDaysLeft", { count: m.daysToExpiry })}
                        </StatusPill>
                      )}
                    </div>
                    <p className="mt-inline font-mono text-[12px] text-muted">{m.code}</p>
                    <p className="text-[12px] text-muted">
                      {t("mPeriod", {
                        from: formatDate(m.startedAt),
                        to: formatDate(m.expiresAt),
                      })}
                      {" · "}
                      {m.visitsLeft == null
                        ? t("mUnlimited")
                        : t("mVisitsLeft", { count: m.visitsLeft })}
                    </p>
                    {m.members.length > 0 && (
                      <p className="mt-inline break-words text-[12px] text-muted">
                        {t("mCovers", { names: m.members.map((x) => x.name).join(", ") })}
                      </p>
                    )}
                    {m.cancelReason && (
                      <p className="mt-inline break-words text-[12px] text-muted">
                        {t("mCancelled", { reason: m.cancelReason })}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-inline">
                    {(m.effectiveStatus === "lapsed" || m.expiringSoon) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === m.id}
                        onClick={() => act(m.id, () => renewMembership(m.id), t("mRenewed"))}
                      >
                        {t("mRenew")}
                      </Button>
                    )}
                    {m.effectiveStatus === "active" && (
                      <Button
                        size="sm"
                        variant="tertiary"
                        loading={busy === m.id}
                        onClick={() => act(m.id, () => pauseMembership(m.id), t("mPaused"))}
                      >
                        {t("mPause")}
                      </Button>
                    )}
                    {m.effectiveStatus === "paused" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busy === m.id}
                        onClick={() => act(m.id, () => resumeMembership(m.id), t("mResumed"))}
                      >
                        {t("mResume")}
                      </Button>
                    )}
                    {m.effectiveStatus !== "cancelled" && (
                      <CancelButton membership={m} onCancelled={onChanged} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-section">
        <div className="flex flex-wrap items-center justify-between gap-tight">
          <h3 className="type-label text-[12px] text-muted">{t("pointsHeading")}</h3>
          <Button size="sm" variant="secondary" onClick={() => setAdjustOpen(true)}>
            {t("adjustPoints")}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-tight sm:grid-cols-4">
          <Stat label={t("pointsBalance")} value={points.balance.toLocaleString()} />
          <Stat label={t("pointsEarned")} value={points.lifetimeEarned.toLocaleString()} />
          <Stat label={t("pointsSpent")} value={points.lifetimeSpent.toLocaleString()} />
          <Stat
            label={t("pointsExpiring")}
            value={points.expiringSoon.toLocaleString()}
            tone={points.expiringSoon > 0 ? "warning" : undefined}
          />
        </div>

        {points.entries.length === 0 ? (
          <p className="text-[13px] text-faint">{t("noPoints")}</p>
        ) : (
          <ul className="flex flex-col gap-inline">
            {points.entries.slice(0, 12).map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline justify-between gap-tight rounded-sm border border-line p-comfortable text-[13px]"
              >
                <span className="min-w-0">
                  <StatusPill tone={e.kind === "spend" ? "neutral" : "success"}>
                    {t(`pkind_${e.kind}` as "pkind_earn")}
                  </StatusPill>{" "}
                  <span className="text-muted">{e.note ?? t("pointsFromSale")}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-mono">
                  {e.kind === "spend" ? "−" : "+"}
                  {e.points.toLocaleString()} · {formatDate(e.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SellMembershipModal
        open={sellOpen}
        customerId={customerId}
        onClose={() => setSellOpen(false)}
        onSold={() => {
          setSellOpen(false);
          onChanged();
        }}
      />
      <AdjustPointsModal
        open={adjustOpen}
        customerId={customerId}
        onClose={() => setAdjustOpen(false)}
        onAdjusted={() => {
          setAdjustOpen(false);
          onChanged();
        }}
      />
    </div>
  );
}

/** Cancelling always carries a reason — it is the first thing anyone asks
 *  when a member rings up about it later. */
function CancelButton({
  membership,
  onCancelled,
}: {
  membership: MembershipView;
  onCancelled: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const res = await cancelMembership(membership.id, reason);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.reason ?? res.error.message);
      return;
    }
    setOpen(false);
    setReason("");
    toast.success(t("mCancelledToast"));
    onCancelled();
  };

  return (
    <>
      <Button size="sm" variant="tertiary" onClick={() => setOpen(true)}>
        {t("mCancel")}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("mCancelTitle", { tier: membership.tierName })}
        description={t("mCancelDescription", { expires: formatDate(membership.expiresAt) })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("mKeepIt")}
            </Button>
            <Button variant="destructive" onClick={submit} loading={saving}>
              {t("mCancel")}
            </Button>
          </>
        }
      >
        <FormField
          label={t("mCancelReason")}
          variant="textarea"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          help={t("mCancelReasonHelp")}
        />
      </Modal>
    </>
  );
}

function SellMembershipModal({
  open,
  customerId,
  onClose,
  onSold,
}: {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onSold: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const tiersQ = useApiQuery(() => listMembershipTiers({ pageSize: 50 }), [open]);
  const [busy, setBusy] = useState<string | null>(null);

  const sell = async (tierId: string) => {
    setBusy(tierId);
    const res = await issueMembership({ customerId, tierId });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("membershipIssued", { code: res.data.code }));
    onSold();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("sellMembershipTitle")}
      description={t("sellMembershipDescription")}
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
      }
    >
      {tiersQ.loading && <div className="h-24 animate-pulse rounded-sm bg-subtle" />}
      <ul className="flex flex-col gap-tight">
        {(tiersQ.data?.data ?? []).map((tier) => (
          <li
            key={tier.id}
            className="flex flex-wrap items-center justify-between gap-tight rounded-sm border border-line p-comfortable"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-medium">{tier.name}</p>
              <p className="break-words text-[12px] text-muted">{tier.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-tight">
              <span className="whitespace-nowrap font-mono text-sm">{formatMoney(tier.price)}</span>
              <Button size="sm" loading={busy === tier.id} onClick={() => sell(tier.id)}>
                {t("issue")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function AdjustPointsModal({
  open,
  customerId,
  onClose,
  onAdjusted,
}: {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const res = await adjustPoints(customerId, Number(points), note);
    setSaving(false);
    if (!res.ok) {
      toast.error(
        res.error.fieldErrors?.note ?? res.error.fieldErrors?.points ?? res.error.message,
      );
      return;
    }
    setPoints("");
    setNote("");
    toast.success(t("pointsAdjusted"));
    onAdjusted();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("adjustPointsTitle")}
      description={t("adjustPointsDescription")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!points.trim() || !note.trim()}>
            {t("adjustPoints")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <FormField
          label={t("adjustAmount")}
          variant="number"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          help={t("adjustAmountHelp")}
        />
        <FormField
          label={t("adjustNote")}
          variant="textarea"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          help={t("adjustNoteHelp")}
        />
      </div>
    </Modal>
  );
}
