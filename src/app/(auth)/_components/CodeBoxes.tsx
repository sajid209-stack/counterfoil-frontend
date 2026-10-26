"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

const N = 6;

/* Six single-digit boxes. Typing moves forward, Backspace on an empty box
   moves back, a paste (or the phone's one-time-code fill) spreads across all. */
export function CodeBoxes({
  value,
  onChange,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("auth.signUp");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length: N }, (_, i) => value[i] ?? "");
  const focus = (i: number) => refs.current[Math.max(0, Math.min(N - 1, i))]?.focus();

  /* Put `digits` into the code starting at box `from`. */
  const fill = (from: number, digits: string) => {
    const next = chars.slice();
    let i = from;
    for (const d of digits) {
      if (i >= N) break;
      next[i++] = d;
    }
    onChange(next.join(""));
    focus(Math.min(i, N - 1));
  };

  return (
    <div role="group" aria-label={t("codeGroup")} aria-describedby={describedBy} className="flex justify-between gap-tight">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={c}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={N}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("digit", { n: i + 1 })}
          aria-invalid={invalid || undefined}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            if (!digits) {
              const next = chars.slice();
              next[i] = "";
              onChange(next.join(""));
              return;
            }
            fill(i, digits);
          }}
          onPaste={(e) => {
            e.preventDefault();
            const digits = e.clipboardData.getData("text").replace(/\D/g, "");
            if (digits) fill(digits.length >= N ? 0 : i, digits);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !c) {
              e.preventDefault();
              if (i > 0) {
                const next = chars.slice();
                next[i - 1] = "";
                onChange(next.join(""));
              }
              focus(i - 1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          className={cn(
            "h-12 min-w-0 flex-1 rounded-control border bg-card text-center text-xl font-semibold text-fg transition-colors duration-quick ease-counterfoil",
            invalid ? "border-danger" : "border-line hover:border-strong focus:border-ember",
          )}
        />
      ))}
    </div>
  );
}
