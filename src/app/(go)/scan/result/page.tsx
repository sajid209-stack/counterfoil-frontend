"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { admitTicket } from "@/lib/api";

interface Outcome {
  accept: boolean;
  code: string;
  reason: string;
  group?: { ticketId: string; tierName: string; admits: number; admitted: number };
}

// The scan result. Must read in under a second at arm's length: colour AND
// shape (check vs cross) AND text ("ADMIT" vs "DO NOT ADMIT") all carry it, so
// it survives glare and colour-blindness. Group tickets (Family admits 4) take
// the arriving count right here — partial groups honoured.
export default function ScanResultPage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [admitted, setAdmitted] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan_result");
    if (raw) {
      const o: Outcome = JSON.parse(raw);
      setOutcome(o);
      setAdmitted(o.group?.admitted ?? 0);
    } else router.replace("/scan");
  }, [router]);

  // Non-group results auto-ready for the next scan.
  useEffect(() => {
    if (!outcome || outcome.group) return;
    const t = setTimeout(() => router.push("/scan"), 2000);
    return () => clearTimeout(t);
  }, [outcome, router]);

  if (!outcome) return null;

  const accept = outcome.accept;
  const group = outcome.group;
  const remaining = group ? group.admits - admitted : 0;

  const admit = async (count: number) => {
    if (!group || busy) return;
    setBusy(true);
    const res = await admitTicket(group.ticketId, count);
    setBusy(false);
    if (res.ok) setAdmitted(res.data.admitted ?? 0);
  };

  // Group ticket: the big state stays, plus the count controls.
  // Accepted = paper on ink; refused = hatched danger. Judged at 3 metres by
  // shape (check vs cross), surface (solid vs hatch) and text — never colour.
  if (accept && group) {
    return (
      <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-major bg-ink px-section py-hero text-center text-paper">
        <span className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-paper">
          <Check size={72} strokeWidth={3} />
        </span>
        <span className="type-display text-5xl">ADMIT {remaining > 0 ? remaining : "—"}</span>
        <span className="type-body text-xl text-paper/90">{outcome.reason} · group of {group.admits} · {admitted} in</span>
        <span className="font-mono text-sm text-paper/70">{outcome.code}</span>
        {remaining > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-tight">
            <button type="button" disabled={busy} onClick={() => admit(1)} className="h-14 rounded-sm border-2 border-paper px-major text-lg font-medium active:bg-paper/20">+1</button>
            <button type="button" disabled={busy} onClick={() => admit(remaining)} className="h-14 rounded-sm bg-paper px-major text-lg font-medium text-ink active:bg-paper/80">
              Admit all {remaining}
            </button>
          </div>
        ) : (
          <span className="type-body text-lg">Everyone&apos;s in — ticket redeemed.</span>
        )}
        <button type="button" onClick={() => router.push("/scan")} className="mt-major text-[13px] text-paper/70 underline-offset-4 hover:underline">Scan the next ticket</button>
      </main>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/scan")}
      className={`flex min-h-[70vh] w-full flex-col items-center justify-center gap-major px-section py-hero text-center ${
        accept
          ? "bg-ink text-paper"
          : "bg-danger text-white bg-[repeating-linear-gradient(45deg,transparent,transparent_28px,rgba(0,0,0,0.18)_28px,rgba(0,0,0,0.18)_56px)]"
      }`}
    >
      <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-current">
        {accept ? <Check size={80} strokeWidth={3} /> : <X size={80} strokeWidth={3} />}
      </span>
      <span className="type-display text-5xl">{accept ? "ADMIT" : "DO NOT ADMIT"}</span>
      <span className="type-body text-2xl opacity-90">{outcome.reason}</span>
      <span className="font-mono text-sm opacity-70">{outcome.code}</span>
      <span className="mt-major text-[13px] opacity-60">Ready for the next scan in a moment — or tap anywhere</span>
    </button>
  );
}
