"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "link"
  | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // Solid ember — the one brand accent for the primary action. Never an outline.
  // ink text on ember passes AA; white would not.
  primary: "bg-ember text-ink hover:opacity-90 disabled:bg-line disabled:text-faint",
  secondary:
    "bg-card text-fg border border-line hover:border-inverse disabled:text-faint disabled:border-line",
  tertiary: "bg-transparent text-fg hover:bg-line disabled:text-faint",
  link: "bg-transparent text-ember underline underline-offset-2 hover:opacity-80 disabled:text-faint",
  destructive: "bg-danger text-white hover:opacity-90 disabled:opacity-40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-11 md:h-9 px-comfortable text-[13px]", // 44px on touch, 36 from md
  md: "h-11 px-section text-sm", // 44px
  lg: "h-12 px-major text-base", // 48px — Go touch floor
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** lucide icon element, rendered before the label */
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      icon,
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
      className={cn(
        "inline-flex items-center justify-center gap-tight rounded-sm font-medium",
        // Press feedback: a button that changes only on hover gives a touch
        // user nothing at the moment they commit. Transform is composited, so
        // this costs no layout. The global prefers-reduced-motion block turns
        // the transition off; the scale is small enough to be unobjectionable
        // even applied instantly.
        "transition-[colors,transform] duration-quick ease-counterfoil",
        "active:scale-[0.98] disabled:active:scale-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        variant === "link" ? "" : SIZES[size],
        VARIANTS[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {!loading && icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
