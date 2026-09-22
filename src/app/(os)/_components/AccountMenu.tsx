"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Settings as SettingsIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppearancePicker } from "@/components/ThemeProvider";
import { LanguagePicker } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

/**
 * The account button — and the two switchers that used to sit beside it.
 *
 * The owner's review: *"moving the mode and language switchers away from the
 * top bar … only the current page name and basic settings on the top bar."*
 * They were two permanent controls, ~140px of every bar at every width, for a
 * decision a person makes roughly once. Here they are one 44px target that
 * opens onto both of them, which is where every mature admin product keeps
 * them.
 *
 * Nothing is duplicated to get this: it opens the same `AppearancePicker` and
 * `LanguagePicker` that Settings → Preferences and the Go shift menu already
 * render, so the three places agree by construction. Unlike the old header
 * button it also offers **System**, which the one-tap flip could not express.
 */
export function AccountMenu({ name, compact = false }: { name?: string; compact?: boolean }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    // Pointer down, not click: a click listener added during the click that
    // opened the menu fires on that same event and shuts it again.
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = (name ?? "CF").slice(0, 2).toUpperCase();

  return (
    <div ref={wrap} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
        className={cn(
          "flex h-11 items-center gap-tight rounded-sm text-muted transition-colors duration-quick hover:text-fg active:bg-ember/10",
          compact ? "w-11 justify-center" : "border border-line bg-card pl-inline pr-tight hover:border-ember/40",
          open && "text-fg",
        )}
      >
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-subtle text-[12px] font-bold text-fg ring-1 ring-line">
          {initials}
        </span>
        {!compact && <ChevronDown size={16} strokeWidth={1.5} aria-hidden />}
      </button>

      {open && (
        // Right-anchored and 280px wide, so it lands inside the viewport at
        // 320 as well as at 1440 — the trigger sits at the right edge of the
        // bar in both bars.
        <div
          role="menu"
          aria-label={t("account")}
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-md border border-line bg-card p-section shadow-lg"
        >
          <p className="truncate text-sm font-semibold text-fg">{name ?? "Counterfoil"}</p>
          <p className="mt-inline truncate font-mono text-[12px] text-muted">{t("workspace")}</p>

          <div className="mt-section flex flex-col gap-section border-t border-hairline pt-section">
            <AppearancePicker />
            <LanguagePicker />
          </div>

          <Link
            href="/settings/business"
            onClick={() => setOpen(false)}
            className="mt-section flex h-11 items-center gap-comfortable rounded-sm border border-line px-comfortable text-sm font-medium text-fg transition-colors duration-quick hover:border-ember/40 hover:bg-subtle/60"
          >
            <SettingsIcon size={16} strokeWidth={1.5} className="text-muted" aria-hidden />
            {t("settings")}
          </Link>
        </div>
      )}
    </div>
  );
}
