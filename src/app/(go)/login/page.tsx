"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Keypad } from "../_components/Keypad";

export default function GoLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  const onKey = (d: string) => {
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) setTimeout(() => router.push("/shift/open"), 150);
  };

  return (
    <main className="mx-auto flex max-w-xs flex-col items-center gap-major px-section py-hero">
      <div className="text-center">
        <p className="type-label text-[13px] text-ember">Staff sign in</p>
        <h1 className="type-h1 mt-tight text-2xl">Enter your PIN</h1>
      </div>
      <div className="flex gap-tight" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 border-ink ${i < pin.length ? "bg-ink" : "bg-transparent"}`}
          />
        ))}
      </div>
      <Keypad onKey={onKey} onBackspace={() => setPin((p) => p.slice(0, -1))} />
    </main>
  );
}
