"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The one button.
 *
 * Use `primary` for the single action that moves the screen forward (one per
 * screen), `secondary` for everything else that deserves an edge,
 * `tertiary` for quiet in-toolbar actions, `destructive` for removing or
 * cancelling something, and `link` for a navigation that reads as text.
 * Use `size="icon"` for a square, label-less button — it REQUIRES an
 * `aria-label` (a glyph is not a name).
 *
 * States it draws itself: hover, focus-visible (the global ring — never a
 * per-component one), pressed, disabled, loading (width kept, spinner over an
 * invisible label) and `selected` (a toggle button, exposed as aria-pressed).
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "link"
  | "destructive";
/** `icon` is a square, label-less button: 44px on touch, 36 from md. */
export type ButtonSize = "sm" | "md" | "lg" | "icon";
/** OS and Go both take `rounded-control` — 6px in OS, a pill in Go, set by the
 *  product token — so a Go page no longer needs a per-call prop. `pill`
 *  still works and forces the full round in either product. */
export type ButtonShape = "default" | "pill";

const VARIANTS: Record<ButtonVariant, string> = {
  /* Solid ember-solid (brand-600, 4.64:1 under white) — the one brand accent
     for the primary action. Never an outline. */
  primary: "bg-ember-solid text-on-solid enabled:hover:opacity-90",
  /* The stroke stays (a secondary button on a white card needs an edge to be
     found) but hovers one step firmer, not to ink. */
  secondary:
    "bg-card text-fg border border-line enabled:hover:border-strong enabled:hover:bg-muted-wash",
  tertiary: "bg-transparent text-fg enabled:hover:bg-muted-wash",
  link: "bg-transparent text-brand-foreground underline underline-offset-2 enabled:hover:opacity-80",
  destructive: "bg-danger-solid text-on-solid enabled:hover:opacity-90",
};

/* One disabled treatment. A solid fill cannot just fade — white on a 50% ember
   is unreadable — so a disabled solid becomes the neutral `line` fill with
   `muted` text (still readable); everything else fades to half strength. In
   both cases the cursor says "not allowed" and the press feedback is gone. */
const SOLID = new Set<ButtonVariant>(["primary", "destructive"]);
const DISABLED_SOLID = "disabled:bg-line disabled:text-muted";
const DISABLED_SOFT = "disabled:opacity-50";

/* A toggle button that is on. aria-pressed says it to assistive tech; this
   says it to the eye without relying on colour alone (a firmer edge/fill). */
const SELECTED: Partial<Record<ButtonVariant, string>> = {
  secondary: "border-strong bg-muted-wash",
  tertiary: "bg-muted-wash",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-11 md:h-9 px-comfortable text-sm", // 44px on touch, 36 from md
  md: "h-11 px-section text-base", // 44px
  lg: "h-12 in-data-[product=go]:h-13 px-major text-md", // 48px; 52 in Go, the till's primary height
  icon: "h-11 w-11 md:h-9 md:w-9 p-0 text-base", // square; needs aria-label
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  fullWidth?: boolean;
  /** lucide icon element, rendered before the label */
  icon?: React.ReactNode;
  /** A toggle button's on state → `aria-pressed`. Leave undefined for an
   *  ordinary action button (no aria-pressed at all). */
  selected?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      shape = "default",
      loading = false,
      fullWidth = false,
      icon,
      selected,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-pressed={selected}
      className={cn(
        "relative inline-flex items-center justify-center gap-tight font-medium",
        shape === "pill" ? "rounded-full" : "rounded-control",
        // Press feedback: a button that changes only on hover gives a touch
        // user nothing at the moment they commit. Transform is composited, so
        // this costs no layout. The global prefers-reduced-motion block turns
        // the transition off.
        "transition-[colors,transform] duration-quick ease-counterfoil",
        "active:scale-[0.98] disabled:active:scale-100",
        "disabled:cursor-not-allowed",
        variant === "link" ? "" : SIZES[size],
        VARIANTS[variant],
        SOLID.has(variant) ? DISABLED_SOLID : DISABLED_SOFT,
        selected && SELECTED[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {/* Loading keeps the button's width: the label stays in the layout but
          invisible, and the spinner sits over it. Swapping the label for a
          spinner made every loading button jump narrower. */}
      {loading ? (
        <>
          <span className="invisible inline-flex items-center justify-center gap-tight">
            {icon}
            {children}
          </span>
          <span aria-hidden className="absolute inset-0 flex items-center justify-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          </span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  ),
);
Button.displayName = "Button";

/**
 * The button's look as a class string, for an element that must be something
 * else — a link (`ButtonLink`) or a label. `enabled:` only matches form
 * controls, so for a non-button the hover states are plain `hover:`.
 */
export function buttonClass({
  variant = "primary",
  size = "md",
  shape = "default",
  fullWidth = false,
  asButton = true,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  fullWidth?: boolean;
  asButton?: boolean;
} = {}): string {
  const look = asButton ? VARIANTS[variant] : VARIANTS[variant].replaceAll("enabled:hover:", "hover:");
  return cn(
    "relative inline-flex items-center justify-center gap-tight font-medium",
    shape === "pill" ? "rounded-full" : "rounded-control",
    "transition-[colors,transform] duration-quick ease-counterfoil active:scale-[0.98]",
    variant === "link" ? "" : SIZES[size],
    look,
    fullWidth && "w-full",
  );
}

/**
 * A link that looks like a button: navigation (an internal route), or an
 * action the platform performs (`tel:`, `sms:`, `mailto:`, a download). Use
 * it whenever pressing it GOES somewhere — a real <a> keeps open-in-new-tab,
 * the status-bar URL and the right screen-reader role. Internal routes go
 * through next/link; anything with a scheme is a plain anchor.
 */
export const ButtonLink = forwardRef<
  HTMLAnchorElement,
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    shape?: ButtonShape;
    fullWidth?: boolean;
    icon?: React.ReactNode;
  }
>(({ href, variant = "secondary", size = "md", shape, fullWidth, icon, className, children, ...props }, ref) => {
  const cls = cn(buttonClass({ variant, size, shape, fullWidth, asButton: false }), className);
  const inner = (
    <>
      {icon}
      {children}
    </>
  );
  return /^[a-z][a-z0-9+.-]*:/i.test(href) ? (
    <a ref={ref} href={href} className={cls} {...props}>
      {inner}
    </a>
  ) : (
    <Link ref={ref} href={href} className={cls} {...props}>
      {inner}
    </Link>
  );
});
ButtonLink.displayName = "ButtonLink";
