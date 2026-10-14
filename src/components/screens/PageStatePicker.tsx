"use client";

import { Eye, Inbox, LoaderCircle, LockKeyhole, SearchX, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SCREEN_STATES, setScreenState, useScreenState, type ScreenState } from "@/lib/screenState";

const ICON: Record<ScreenState, typeof Eye> = {
  live: Eye,
  loading: LoaderCircle,
  empty: Inbox,
  error: TriangleAlert,
  notFound: SearchX,
  sessionExpired: LockKeyhole,
};

/**
 * "Page state" — the dropdown beside the venue / counter picker that lets a
 * developer or designer see any page in any of its six states: live, loading,
 * empty, error, not found, signed out. Real data almost never shows the other
 * five, so they rot unseen; this makes walking them a two-tap job.
 *
 * It is a lens on the whole shell, not on one page: the choice is held per
 * browser (`lib/screenState`) and both shells draw the chosen face in place of
 * the page. Anything but Live turns the control amber with a ring, so nobody
 * forgets they are previewing and mistakes a sample for their real data.
 *
 *   size="md"  the admin bar (44px on touch, like the venue picker)
 *   size="lg"  the till's header (48px touch floor)
 *   full       a labelled row, for a menu sheet that has no bar around it
 */
export function PageStatePicker({
  size = "md",
  full = false,
  className,
}: {
  size?: "md" | "lg";
  full?: boolean;
  className?: string;
}) {
  const t = useTranslations("screens");
  const state = useScreenState();
  const Icon = ICON[state];
  const previewing = state !== "live";

  const select = (
    <Select
      aria-label={t("states.label")}
      value={state}
      onChange={(v) => setScreenState(v as ScreenState)}
      size={size}
      icon={<Icon size={15} strokeWidth={1.75} aria-hidden />}
      options={SCREEN_STATES.map((s) => ({ value: s, label: t(`states.${s}`) }))}
      className={cn(full ? "w-full" : "w-max", className)}
      /* The `!` is deliberate: the trigger already paints its own fill, edge
         and ink, and `cn` does not merge conflicting utilities. */
      triggerClassName={cn("min-w-0", previewing && "border-warning-line! bg-warning-wash! text-warning! ring-2 ring-warning-line", full && "w-full")}
      dataAttrs={{ "data-page-state": state }}
    />
  );

  return full ? (
    <div>
      <p className="pb-1 text-sm font-medium text-muted">{t("states.label")}</p>
      {select}
    </div>
  ) : (
    select
  );
}

/**
 * The phone's reminder. The picker lives in the menu sheet, which is closed
 * most of the time, so on a phone nothing would say a preview is running. This
 * chip sits in the top bar while one is, names the state, and one tap puts the
 * page back to Live. Draws nothing when the page is live.
 */
export function PreviewChip({ className, compact = false }: { className?: string; /** Icon and close only, where the bar is short of room. The state is still the accessible name. */ compact?: boolean }) {
  const t = useTranslations("screens");
  const state = useScreenState();
  if (state === "live") return null;
  const Icon = ICON[state];
  return (
    <button
      type="button"
      onClick={() => setScreenState("live")}
      aria-label={t("states.exit", { state: t(`states.${state}`) })}
      className={cn(
        "flex h-11 min-w-11 shrink-0 items-center justify-center gap-inline rounded-full border border-warning-line bg-warning-wash px-comfortable text-sm font-medium text-warning",
        className,
      )}
    >
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      <span className={cn(compact && "sr-only")}>{t(`states.${state}`)}</span>
      <X size={14} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
