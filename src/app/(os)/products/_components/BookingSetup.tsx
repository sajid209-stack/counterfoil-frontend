"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { BookingTypeCode } from "@/lib/api";

/* The booking setup flow. Replaces the booking-type dropdown entirely: the
   operator answers plain questions and the BT code is DERIVED, never shown.
   Reports { bookingType, summary, validityDays } up to the parent. */

export interface BookingSetupResult {
  bookingType: BookingTypeCode;
  summary: string;
  validityDays?: number;
}

type Q1 = "anytime" | "date" | "datetime";

function Option({
  title,
  helper,
  onClick,
}: {
  title: string;
  helper: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-inline rounded-sm border border-neutral-200 bg-white p-section text-left transition-colors hover:border-ink"
    >
      <span className="text-sm font-medium">{title}</span>
      <span className="text-[13px] text-neutral-400">{helper}</span>
    </button>
  );
}

export function BookingSetup({
  value,
  onChange,
}: {
  value: BookingSetupResult | null;
  onChange: (result: BookingSetupResult | null) => void;
}) {
  const [step, setStep] = useState<"q1" | "q2" | "q3" | "q3b">("q1");
  const [q1, setQ1] = useState<Q1 | null>(null);

  const finish = (bookingType: BookingTypeCode, summary: string, validityDays?: number) =>
    onChange({ bookingType, summary, validityDays });

  // Completed — show the plain-language summary, no code.
  if (value) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-major">
        <div className="flex items-start justify-between gap-section">
          <p className="type-body text-sm">{value.summary}</p>
          <button
            type="button"
            onClick={() => {
              setStep("q1");
              setQ1(null);
              onChange(null);
            }}
            className="flex shrink-0 items-center gap-inline text-[13px] text-ember hover:underline"
          >
            <Pencil size={14} strokeWidth={1.5} /> Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-tight">
      {step === "q1" && (
        <>
          <p className="type-h2 mb-tight text-base">Does the visitor choose when they&apos;re coming?</p>
          <Option title="No, any time" helper="Visitors come whenever they like. No date needed." onClick={() => finish("BT-01", "Visitors can come any time — no date needed.")} />
          <Option title="They choose a date" helper="Visitors pick which day they're coming." onClick={() => { setQ1("date"); setStep("q2"); }} />
          <Option title="They choose a date and time" helper="Visitors pick a specific time slot." onClick={() => { setQ1("datetime"); setStep("q3"); }} />
        </>
      )}

      {step === "q2" && (
        <>
          <p className="type-h2 mb-tight text-base">Do you limit how many visitors per day?</p>
          <Option title="No limit" helper="Sell as many as you like." onClick={() => finish("BT-02", "Visitors pick a date. No daily limit.", 1)} />
          <Option title="Yes, cap it per day" helper="Once full, that date stops selling." onClick={() => finish("BT-06", "Visitors pick a date, capped per day. Once full, that date stops selling.")} />
          <BackLink onClick={() => setStep("q1")} />
        </>
      )}

      {step === "q3" && (
        <>
          <p className="type-h2 mb-tight text-base">Is it led by a guide or host?</p>
          <Option title="No — visitors arrive at a set time" helper="Like a screening or a scheduled session." onClick={() => finish("BT-03", "Visitors pick a date and time. Runs at set start times.")} />
          <Option title="Yes — a guide runs each departure" helper="Capacity is limited by who's available to lead." onClick={() => finish("BT-09", "Visitors pick a date and time. A guide runs each departure.")} />
          <BackLink onClick={() => setStep("q1")} />
        </>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-tight self-start text-[13px] text-neutral-400 hover:text-ink">
      ← Back
    </button>
  );
}
