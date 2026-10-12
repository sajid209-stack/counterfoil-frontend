"use client";

import Link from "next/link";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "success" | "warning" | "danger" | "neutral";

/**
 * Tone → container, icon colour, title colour, default icon.
 *
 * This is the Color System's "With surface" alert: a `*-wash` fill, a
 * `border-*-line` edge, and the tone's own foreground token on the icon and the
 * title. The body copy stays `fg` (the washes are tuned against it in light and
 * dark), and the words always carry the meaning, so colour never has to.
 * Nothing here is derived from an alpha or a `dark:` override — light and dark
 * differ only because the tokens do. `neutral` is the quiet one: `subtle` with a
 * `line` edge, which is what makes it visible in dark, where `subtle` and the
 * card are the same value.
 */
const TONES: Record<NoticeTone, { box: string; icon: string; title: string; Icon: LucideIcon }> = {
  info: { box: "border border-info-line bg-info-wash", icon: "text-info", title: "text-info", Icon: Info },
  success: { box: "border border-success-line bg-success-wash", icon: "text-success", title: "text-success", Icon: CircleCheck },
  warning: { box: "border border-warning-line bg-warning-wash", icon: "text-warning", title: "text-warning", Icon: TriangleAlert },
  danger: { box: "border border-danger-line bg-danger-wash", icon: "text-danger", title: "text-danger", Icon: CircleAlert },
  neutral: { box: "border border-line bg-subtle", icon: "text-muted", title: "text-fg", Icon: Info },
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
        {title && <p className={cn("font-semibold", cfg.title, small ? "text-sm" : "text-base")}>{title}</p>}
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
