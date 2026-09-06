"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Modal } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listMembershipTiers, type LoyaltyAccount, type LoyaltyProgram, type MembershipTier } from "@/lib/api";
import { formatMoney } from "@/lib/format";

/** Sell a membership at the counter (§16.8). It needs a customer attached —
 *  a membership nobody holds is not a thing. */
export function MembershipSheet({
  open,
  onClose,
  hasCustomer,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  hasCustomer: boolean;
  onPick: (tier: MembershipTier) => void;
}) {
  const t = useTranslations("pos");
  const tiersQ = useApiQuery(() => listMembershipTiers({ pageSize: 50 }), [open]);
  const tiers = tiersQ.data?.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("membership.title")}
      description={t("membership.description")}
      footer={
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("membership.close")}
        </Button>
      }
    >
      {!hasCustomer ? (
        <div className="rounded-sm border-l-2 border-ember bg-ember/5 p-comfortable">
          <p className="text-sm font-medium">{t("membership.needCustomerTitle")}</p>
          <p className="mt-inline text-[13px] text-muted">{t("membership.needCustomerBody")}</p>
        </div>
      ) : (
        <>
          {tiersQ.loading && <div className="h-24 animate-pulse rounded-sm bg-subtle" />}
          <ul className="flex flex-col gap-tight">
            {tiers.map((tier) => (
              <li key={tier.id}>
                <button
                  type="button"
                  onClick={() => onPick(tier)}
                  className="flex min-h-12 w-full items-center justify-between gap-tight rounded-sm border border-line p-comfortable text-left transition-colors duration-quick hover:bg-subtle active:bg-ember/10"
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-medium">{tier.name}</span>
                    <span className="block break-words text-[13px] text-muted">
                      {tier.description}
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap font-mono text-sm">
                    {formatMoney(tier.price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

/** Spend a customer's points against the sale (§17.8). */
export function PointsSheet({
  open,
  onClose,
  account,
  program,
  maxPoints,
  current,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  account: LoyaltyAccount | null;
  program: LoyaltyProgram | undefined;
  /** The most that can usefully go on THIS sale. */
  maxPoints: number;
  current: number;
  onApply: (points: number) => void;
}) {
  if (!account || !program) return null;
  return (
    <PointsSheetBody
      // Remount whenever the sheet opens or the usable ceiling moves, so the
      // slider always starts at what is actually spendable on THIS sale
      // rather than at whatever was true when the till first rendered.
      key={`${open}-${maxPoints}`}
      open={open}
      onClose={onClose}
      account={account}
      program={program}
      maxPoints={maxPoints}
      current={current}
      onApply={onApply}
    />
  );
}

function PointsSheetBody({
  open,
  onClose,
  account,
  program,
  maxPoints,
  current,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  account: LoyaltyAccount;
  program: LoyaltyProgram;
  maxPoints: number;
  current: number;
  onApply: (points: number) => void;
}) {
  const t = useTranslations("pos");
  const [draft, setDraft] = useState(current || maxPoints);

  const value = draft * program.pointValue;
  const belowMin = draft > 0 && draft < program.minRedeemPoints;
  const chips = [program.minRedeemPoints, 500, 1000, maxPoints]
    .filter((n, i, arr) => n > 0 && n <= maxPoints && arr.indexOf(n) === i)
    .sort((a, b) => a - b);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("points.title")}
      description={t("points.description", {
        balance: account.balance.toLocaleString(),
        worth: formatMoney(account.balance * program.pointValue),
      })}
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              onApply(0);
              onClose();
            }}
          >
            {t("points.none")}
          </Button>
          <Button
            size="lg"
            disabled={belowMin || draft <= 0}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {t("points.apply", { value: formatMoney(value) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        {maxPoints === 0 ? (
          <p className="text-[13px] text-muted">
            {account.balance < program.minRedeemPoints
              ? t("points.belowMinimum", { min: program.minRedeemPoints })
              : t("points.nothingToSpendOn")}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-tight">
              {chips.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDraft(n)}
                  className={`h-12 rounded-sm border px-section text-sm transition-colors duration-quick ${
                    draft === n
                      ? "border-ember bg-ember/10 text-brand-foreground"
                      : "border-line text-muted"
                  }`}
                >
                  {n === maxPoints ? t("points.allUsable", { count: n }) : n.toLocaleString()}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={maxPoints}
              step={10}
              value={draft}
              onChange={(e) => setDraft(Number(e.target.value))}
              className="w-full accent-ember"
              aria-label={t("points.slider")}
            />
            <div className="rounded-sm border-l-2 border-ember bg-ember/5 p-comfortable">
              <p className="font-mono text-sm">
                {t("points.line", {
                  points: draft.toLocaleString(),
                  value: formatMoney(value),
                })}
              </p>
              {belowMin && (
                <p className="mt-inline text-[13px] text-warning">
                  {t("points.belowMinimum", { min: program.minRedeemPoints })}
                </p>
              )}
              {account.expiringSoon > 0 && (
                <p className="mt-inline text-[13px] text-muted">
                  {t("points.expiringSoon", { count: account.expiringSoon })}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
