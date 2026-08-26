"use client";

import { Delete } from "lucide-react";

// Big touch keypad (48px+ targets; ≥72px in large mode) for PIN and tender.
export function Keypad({
  onKey,
  onBackspace,
  large = false,
}: {
  onKey: (digit: string) => void;
  onBackspace: () => void;
  large?: boolean;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const keyCls = `${large ? "h-20" : "h-16"} rounded-sm border border-line bg-card font-mono text-2xl text-fg active:bg-ember/10`;
  return (
    <div className={`grid grid-cols-3 ${large ? "gap-comfortable" : "gap-tight"}`}>
      {keys.map((k) => (
        <button key={k} type="button" onClick={() => onKey(k)} className={keyCls}>
          {k}
        </button>
      ))}
      <div />
      <button type="button" onClick={() => onKey("0")} className={keyCls}>
        0
      </button>
      <button type="button" onClick={onBackspace} aria-label="Backspace" className={`flex items-center justify-center ${keyCls}`}>
        <Delete size={24} strokeWidth={1.5} />
      </button>
    </div>
  );
}
