"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

interface Outcome {
  accept: boolean;
  code: string;
  reason: string;
}

// The scan result. Must read in under a second at arm's length: colour AND
// shape (check vs cross) AND text ("ADMIT" vs "DO NOT ADMIT") all carry it, so
// it survives glare and colour-blindness.
export default function ScanResultPage() {
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan_result");
    if (raw) setOutcome(JSON.parse(raw));
    else router.replace("/scan");
  }, [router]);

  if (!outcome) return null;

  const accept = outcome.accept;

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
