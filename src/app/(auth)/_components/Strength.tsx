"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type StrengthLevel = 0 | 1 | 2 | 3 | 4; // 0 empty · 1 too short · 2 weak · 3 good · 4 strong

const COMMON = new Set(["password", "password1", "12345678", "123456789", "qwertyui", "11111111", "iloveyou"]);

export function strengthOf(pw: string): StrengthLevel {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (COMMON.has(pw.toLowerCase()) || classes < 2) return 2;
  if (classes >= 3 && pw.length >= 12) return 4;
  return 3;
}

const FILL: Record<number, string> = { 1: "bg-danger-solid", 2: "bg-warning", 3: "bg-success-solid", 4: "bg-success-solid" };

/* Four segments and a word: the word carries the meaning, colour only agrees. */
export function Strength({ password }: { password: string }) {
  const t = useTranslations("auth.signUp.strength");
  const level = strengthOf(password);
  const word = level === 1 ? t("short") : level === 2 ? t("weak") : level === 3 ? t("good") : level === 4 ? t("strong") : "";
  return (
    <div className="flex items-center gap-comfortable" data-strength={level}>
      <div className="flex flex-1 gap-inline" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i <= level ? FILL[level] : "bg-line")} />
        ))}
      </div>
      <span aria-live="polite" className="min-w-16 text-right text-sm text-muted">{word}</span>
    </div>
  );
}
