"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "success" | "warning" | "danger" | "neutral";

/**
 * Tone → background wash, icon colour, default icon.
 *
 * The wash is a soft fill with NO border; the text is always `fg`, because the
 * washes were tuned against `fg` in light and dark (>= 4.5:1). The tone shows
 * in the icon and the tint only, so colour never has to carry the words.
 * `info` has no wash token of its own, so it is the info colour at 10%.
 */
const TONES: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "bg-info/10", icon: "text-info", Icon: Info },
  success: { box: "bg-success-wash", icon: "text-success", Icon: CircleCheck },
  warning: { box: "bg-warning-wash", icon: "text-warning", Icon: TriangleAlert },
  danger: { box: "bg-danger-wash", icon: "text-danger", Icon: CircleAlert },
  neutral: { box: "bg-subtle dark:bg-fg/10", icon: "text-muted", Icon: Info },
};

export interface NoticeAction {
  label: string;
  /** Provide one of the two. `href` renders a link, `onClick` a button. */
  onClick?: () => void;
  href?: string;
  /** Marks the action busy (e.g. while a request runs). */
  busy?: boolean;
  /** `link` (default) is a quiet underlined text action; `button` is a
   *  bordered 44px button for touch surfaces where the action matters. */
  variant?: "link" | "button";
}

/**
 * Notice — an inline message about the thing on the page.
 *
 * Not a toast (those are transient and global) and not a banner pinned to the
 * app: it sits in the content, next to what it is about. `role="status"` for
 * everything except `danger`, which is `role="alert"` so a failure is announced
 * assertively.
 */
export function Notice({
  tone = "info",
  title,
  children,
  icon,
  action,
  onDismiss,
  dismissLabel,
  size = "md",
  className,
}: {
  tone?: NoticeTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Replaces the tone's default icon. Pass `null` for no icon. */
  icon?: React.ReactNode | null;
  action?: NoticeAction;
  onDismiss?: () => void;
  /** Accessible name of the dismiss button. Defaults to the translated "Dismiss". */
  dismissLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("common");
  const cfg = TONES[tone];
  const small = size === "sm";

  const actionClass =
    action?.variant === "button"
      ? "inline-flex min-h-11 w-fit items-center rounded-control border border-strong bg-card px-comfortable text-sm font-semibold text-fg transition-colors duration-quick active:bg-muted-wash"
      : "inline-flex min-h-11 w-fit items-center text-sm font-medium text-fg underline underline-offset-4 transition-colors duration-quick hover:no-underline md:min-h-0";

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-tight rounded-card text-fg",
        cfg.box,
        small ? "px-comfortable py-tight" : "p-comfortable",
        className,
      )}
    >
      {icon !== null && (
        <span aria-hidden className={cn("mt-0.5 shrink-0", cfg.icon)}>
          {icon ?? <cfg.Icon size={small ? 16 : 18} strokeWidth={1.75} />}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-inline">
        {title && <p className={cn("font-semibold", small ? "text-sm" : "text-base")}>{title}</p>}
        {children && <div className={cn(small ? "text-sm" : "text-base")}>{children}</div>}
        {action &&
          (action.href ? (
            <Link href={action.href} className={actionClass}>
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              aria-busy={action.busy}
              className={actionClass}
            >
              {action.label}
            </button>
          ))}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel ?? t("ui.dismiss")}
          className="-m-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:text-fg"
        >
          <X size={16} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </div>
  );
}
