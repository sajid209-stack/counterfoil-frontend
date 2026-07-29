"use client";

import { Delete } from "lucide-react";

// Big touch keypad (48px+ targets) for PIN entry and cash tender.
export function Keypad({
  onKey,
  onBackspace,
}: {
  onKey: (digit: string) => void;
  onBackspace: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="grid grid-cols-3 gap-tight">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className="h-16 rounded-sm border border-neutral-200 bg-white font-mono text-2xl active:bg-neutral-200"
        >
          {k}
        </button>
      ))}
      <div />
      <button
        type="button"
        onClick={() => onKey("0")}
        className="h-16 rounded-sm border border-neutral-200 bg-white font-mono text-2xl active:bg-neutral-200"
      >
        0
      </button>
      <button
        type="button"
        onClick={onBackspace}
        aria-label="Delete"
        className="flex h-16 items-center justify-center rounded-sm border border-neutral-200 bg-white active:bg-neutral-200"
      >
        <Delete size={24} strokeWidth={1.5} />
      </button>
    </div>
  );
}
