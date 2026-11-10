"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings as SettingsIcon, UserRound } from "lucide-react";
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
 *
 * `person` is the phone's variant (docs/mobile.md section 8, v9): the trigger
 * is the header's 40px ink circle with the signed-in person's initials, beside
 * the bell, and the menu is headed by that person rather than the business (on
 * a phone this is "you"; the business heads the menu sheet). It adds Sign out,
 * and Settings goes to the phone's list of sections.
 */
export function AccountMenu({
  name,
  compact = false,
  person,
}: {
  name?: string;
  compact?: boolean;
  person?: { name?: string; sub?: string; label: string; initials: string };
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    // Pointer down, not click: a click listener added during the click that
    // opened the menu fires on that same event and shuts it again.
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = (name ?? "CF").slice(0, 2).toUpperCase();

  const rowCls =
    "flex h-11 items-center gap-comfortable rounded-control px-comfortable text-base font-medium transition-colors duration-quick border border-btn-secondary-line bg-btn-secondary text-fg shadow-sm hover:bg-btn-secondary-hover active:bg-btn-secondary-active";

  return (
    <div ref={wrap} className="relative shrink-0">
      {person ? (
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={person.label}
          data-bar-profile
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-inverse text-sm font-semibold text-inverse-fg transition-opacity duration-quick active:opacity-80"
        >
          {person.initials}
        </button>
      ) : (
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account")}
        className={cn(
          "flex h-11 items-center gap-tight rounded-control text-muted transition-colors duration-quick hover:text-fg active:bg-ember-wash",
          compact ? "w-11 justify-center" : "border border-line bg-card pl-inline pr-tight hover:border-ember-line",
          open && "text-fg",
        )}
      >
        {/* One step down from the button it sits in: two corners of the same
            radius, five pixels apart, cross each other.

            Larger on a phone — 36px inside the same 44px target — because
            there it is one of only two controls in the bar and it was reading
            as a label rather than a button. On desktop it sits inside a
            bordered pill with a chevron, which already says it is pressable. */}
        <span
          aria-hidden
          className={cn(
            "grid shrink-0 place-items-center rounded-xs bg-subtle font-bold text-fg ring-1 ring-line",
            compact ? "h-9 w-9 text-sm" : "h-8 w-8 text-xs",
          )}
        >
          {initials}
        </span>
        {!compact && <ChevronDown size={16} strokeWidth={1.5} aria-hidden />}
      </button>
      )}

      {open && (
        // Right-anchored and 280px wide, so it lands inside the viewport at
        // 320 as well as at 1440 — the trigger sits at the right edge of the
        // bar in both bars.
        <div
          role="menu"
          aria-label={t("account")}
          data-account-menu
          className={cn(
            "absolute right-0 top-[calc(100%+6px)] z-50 w-[280px] rounded-card border border-line bg-card p-section shadow-float",
            person && "max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2rem)] overflow-y-auto",
          )}
        >
          <p className="truncate text-base font-semibold text-fg">{(person ? person.name : name) ?? "Counterfoil"}</p>
          <p className="mt-inline truncate text-xs text-muted">{person ? person.sub : t("workspace")}</p>

          <div className="mt-section flex flex-col gap-section border-t border-hairline pt-section">
            <AppearancePicker />
            <LanguagePicker />
          </div>

          {/* The person's own page first: this is an account menu, and
              everything under it is theirs rather than the business's. */}
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="mt-section flex h-11 items-center gap-comfortable rounded-control px-comfortable text-base font-medium transition-colors duration-quick border border-btn-secondary-line bg-btn-secondary text-fg shadow-sm hover:bg-btn-secondary-hover active:bg-btn-secondary-active"
          >
            <UserRound size={16} strokeWidth={1.5} className="text-muted" aria-hidden />
            {t("myProfile")}
          </Link>
          <Link href={person ? "/settings" : "/settings/business"} onClick={() => setOpen(false)} className={cn("mt-tight", rowCls)}>
            <SettingsIcon size={16} strokeWidth={1.5} className="text-muted" aria-hidden />
            {t("settings")}
          </Link>
          {person && (
            <Link
              href="/signed-out"
              onClick={() => setOpen(false)}
              data-account-signout
              className="mt-tight flex h-11 items-center gap-comfortable rounded-control px-comfortable text-base font-medium text-danger-soft-fg transition-colors duration-quick active:bg-danger-soft"
            >
              <LogOut size={16} strokeWidth={1.5} aria-hidden />
              {t("signOut")}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
