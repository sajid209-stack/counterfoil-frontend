"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, HandCoins } from "lucide-react";
import { Notice, Sheet, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { Minor, WriteOffCategory } from "@/lib/api";
import { WRITE_OFF_CATEGORIES, owedOn, requestOrWriteOff, writeOffNeedsApproval } from "@/lib/api/writeOffRequests";
import { useActor } from "../schedule/_lib/actor";
import { primaryButton, secondaryButton } from "./ActionBar";
import { Tile, TileGrid } from "./Tiles";

/* ── Ask to write off what a guest still owes ─────────────────────────────
 *
 * Money still owed on a party or a booking, that the counter is giving up on:
 * the amount (all of it by default, editable down, refused above what is
 * owed), why as four tiles in plain words, and a note a manager can decide on.
 * Then the same footer as every sheet here — Back on the left, the orange
 * button bottom-right: "Send to a manager", or "Write off ৳X now" where this
 * role may do it on the spot and the amount is within the business's limit.
 */

/* A phone and a tablet held upright keep the bottom sheet; from the desktop up
   it is a dialog, centred on the screen at about 560px. */
const WIDTH = "mx-auto max-w-xl rail:inset-y-0 rail:my-auto rail:h-fit rail:rounded-sheet rail:[animation-name:sf-fade-in]";
const toMinor = (raw: string): Minor => Math.round((parseFloat(raw.replace(/,/g, "")) || 0) * 100);

export function WriteOffSheet({
  open,
  onClose,
  title,
  when,
  orderId,
  bookingId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  when?: string;
  orderId: string;
  bookingId?: string;
  onDone?: () => void;
}) {
  const t = useTranslations("refunds");
  const tc = useTranslations("common");
  const toast = useToast();
  const actor = useActor();
  const owed = owedOn(orderId);
  const [raw, setRaw] = useState(() => String(owed / 100));
  const [category, setCategory] = useState<WriteOffCategory>("uncollectible");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<{ field: "amount" | "note" | "form"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const typed = toMinor(raw);
  const direct = !actor.loading && typed > 0 && typed <= owed && !writeOffNeedsApproval(typed, actor.writeOffMode);

  const fail = (field: "amount" | "note", text: string, focusId: string) => {
    setErr({ field, text });
    document.getElementById(focusId)?.focus();
  };

  const send = async () => {
    if (busy) return;
    if (!(typed > 0)) return fail("amount", t("pos.writeOff.amountNeed"), "wo-amount");
    if (typed > owed) return fail("amount", t("pos.writeOff.amountOver", { owed: formatMoney(owed) }), "wo-amount");
    if (!note.trim()) return fail("note", t("pos.writeOff.noteRequired"), "wo-note");
    setErr(null);
    setBusy(true);
    const res = await requestOrWriteOff({ orderId, bookingId, amount: typed, category, note: note.trim(), requestedBy: actor.name, mode: actor.writeOffMode });
    setBusy(false);
    if (!res.ok) {
      setErr({ field: "form", text: res.error.message || t("pos.writeOff.failed") });
      return;
    }
    toast.success(res.data.status === "approved" ? t("pos.writeOff.doneDirect", { amount: formatMoney(res.data.approvedAmount ?? res.data.amount) }) : t("pos.writeOff.sent"));
    onDone?.();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={direct ? t("pos.writeOff.titleDirect") : t("pos.writeOff.title")}
      closeLabel={tc("close")}
      className={WIDTH}
      lead={<p className="text-base font-medium text-muted">{title}{when ? ` · ${when}` : ""}</p>}
      footer={
        <div className="flex w-full gap-tight">
          <button type="button" className={secondaryButton("h-13", "flex-1")} onClick={onClose} disabled={busy}>
            <ChevronLeft size={20} strokeWidth={2} aria-hidden />
            {t("pos.writeOff.back")}
          </button>
          <button type="button" data-writeoff-primary className={primaryButton("min-h-13 py-2", "flex-[1.4]")} onClick={() => void send()} disabled={busy}>
            <HandCoins size={20} strokeWidth={2} aria-hidden />
            <span className="text-center leading-tight">{direct ? t("pos.writeOff.sendNow", { amount: formatMoney(typed) }) : t("pos.writeOff.send")}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-section p-card">
        <div className="rounded-inner bg-subtle ring-1 ring-inset ring-line p-comfortable">
          <p className="text-base text-muted">{t("pos.writeOff.owes")}</p>
          <p className="text-3xl font-semibold leading-tight tabular-nums text-fg">{formatMoney(owed)}</p>
        </div>

        <label data-focus-host className="flex flex-col gap-tight">
          <span className="text-md font-semibold text-fg">{t("pos.writeOff.amountLabel")}</span>
          <span className="flex h-12 items-center gap-tight rounded-inner bg-subtle ring-1 ring-inset ring-line px-comfortable focus-within:ring-2 focus-within:ring-ember">
            <span aria-hidden className="text-md font-semibold text-muted">৳</span>
            <input
              id="wo-amount"
              inputMode="decimal"
              value={raw}
              onChange={(e) => { setRaw(e.target.value); setErr(null); }}
              aria-invalid={err?.field === "amount"}
              aria-describedby="wo-amount-help"
              className="h-full min-w-0 flex-1 bg-transparent text-right text-lg font-semibold tabular-nums text-fg"
            />
          </span>
          <span id="wo-amount-help" className={cn("text-sm", err?.field === "amount" ? "font-medium text-danger" : "text-muted")}>
            {err?.field === "amount" ? err.text : t("pos.writeOff.amountHint", { owed: formatMoney(owed) })}
          </span>
        </label>

        <fieldset>
          <legend className="mb-tight p-0 text-md font-semibold text-fg">{t("pos.writeOff.categoryLabel")}</legend>
          <TileGrid cols={2} role="radiogroup" aria-label={t("pos.writeOff.categoryLabel")}>
            {WRITE_OFF_CATEGORIES.map((c) => (
              <Tile key={c} role="radio" aria-checked={category === c} selected={category === c} onClick={() => setCategory(c)} className="min-h-14 text-md font-semibold">
                {t(`pos.writeOff.category.${c}`)}
              </Tile>
            ))}
          </TileGrid>
        </fieldset>

        <label data-focus-host className="flex flex-col gap-tight">
          <span className="text-md font-semibold text-fg">{t("pos.writeOff.noteLabel")}</span>
          <textarea
            id="wo-note"
            value={note}
            onChange={(e) => { setNote(e.target.value); setErr(null); }}
            rows={2}
            placeholder={t("pos.writeOff.notePlaceholder")}
            aria-invalid={err?.field === "note"}
            aria-describedby={err?.field === "note" ? "wo-note-err" : undefined}
            className="min-h-[5.5rem] resize-none rounded-inner bg-subtle ring-1 ring-inset ring-line px-comfortable py-tight text-md text-fg focus:ring-2 focus:ring-ember"
          />
          {err?.field === "note" && <span id="wo-note-err" className="text-base font-medium text-danger">{err.text}</span>}
        </label>

        {err?.field === "form" && <Notice tone="danger">{err.text}</Notice>}
        <p className="text-sm text-muted">{direct ? t("pos.writeOff.leadDirect") : t("pos.writeOff.leadAsk")}</p>
      </div>
    </Sheet>
  );
}
