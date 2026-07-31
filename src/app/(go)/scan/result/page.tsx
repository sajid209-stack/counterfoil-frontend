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
  if (accept && group) {
    return (
      <main className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-major bg-success px-section py-hero text-center">
        <span className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-white text-white">
          <Check size={72} strokeWidth={3} />
        </span>
        <span className="type-display text-5xl text-white">ADMIT {remaining > 0 ? remaining : "—"}</span>
        <span className="type-body text-lg text-white/90">{group.tierName} · group of {group.admits} · {admitted} in</span>
        <span className="font-mono text-sm text-white/80">{outcome.code}</span>
        {remaining > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-tight">
            <button type="button" disabled={busy} onClick={() => admit(1)} className="h-14 rounded-sm border-2 border-white px-major text-lg font-medium text-white active:bg-white/20">+1</button>
            <button type="button" disabled={busy} onClick={() => admit(remaining)} className="h-14 rounded-sm bg-white px-major text-lg font-medium text-success active:bg-white/80">
              Admit all {remaining}
            </button>
          </div>
        ) : (
          <span className="type-body text-lg text-white">Everyone&apos;s in — ticket redeemed.</span>
        )}
        <button type="button" onClick={() => router.push("/scan")} className="mt-major text-[13px] text-white/70 underline-offset-4 hover:underline">Scan the next ticket</button>
      </main>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.push("/scan")}
      className={`flex min-h-[70vh] w-full flex-col items-center justify-center gap-major px-section py-hero text-center ${accept ? "bg-success" : "bg-danger"}`}
    >
      <span className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white text-white">
        {accept ? <Check size={80} strokeWidth={3} /> : <X size={80} strokeWidth={3} />}
      </span>
      <span className="type-display text-5xl text-white">{accept ? "ADMIT" : "DO NOT ADMIT"}</span>
      <span className="type-body text-lg text-white/90">{outcome.reason}</span>
      <span className="font-mono text-sm text-white/80">{outcome.code}</span>
      <span className="mt-major text-[13px] text-white/70">Tap anywhere to scan the next ticket</span>
    </button>
  );
}
