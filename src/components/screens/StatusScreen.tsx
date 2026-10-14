"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Check, Copy, LockKeyhole, SearchX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ScreenArt, type ArtTone } from "./ScreenArt";
import { homeFor } from "./registry";
import type { ScreenSurface } from "./types";

export type StatusVariant = "error" | "notFound" | "sessionExpired";

const ART: Record<StatusVariant, { Icon: typeof TriangleAlert; tone: ArtTone }> = {
  error: { Icon: TriangleAlert, tone: "danger" },
  notFound: { Icon: SearchX, tone: "info" },
  sessionExpired: { Icon: LockKeyhole, tone: "warning" },
};

/**
 * The three pages that say "you cannot do what you came to do": something
 * broke, the page is not there, or the sign-in ran out.
 *
 * Each says what happened, what to do next and — for an error — a code to quote
 * (the Stripe and Linear pattern). One primary action each: Try again, Go to
 * the dashboard, Sign in again. One quiet alternative at most.
 *
 *   framed   inside the app frame (the OS shell or the till's shell keeps its
 *            chrome around it); otherwise a whole page, centred in the window.
 *   surface  decides where "go home" goes: the admin dashboard or the till.
 *
 * Every string is in the `screens` messages, so Bangla comes with it. The
 * standalone `global-error` page cannot use this (it has no providers) and
 * carries its own two-language copy.
 */
export function StatusScreen({
  variant,
  framed = false,
  surface = "os",
  reference,
  onRetry,
  onBack,
  onSearch,
  homeHref,
  homeLabel: homeLabelProp,
  title,
  body,
  signInHref = "/sign-in",
  className,
}: {
  variant: StatusVariant;
  framed?: boolean;
  surface?: ScreenSurface;
  /** The code to quote. Drawn for `error` only. */
  reference?: string;
  /** Error: runs when Try again is pressed. */
  onRetry?: () => void;
  /** Not found: a quiet "Go back". */
  onBack?: () => void;
  /** Not found, inside the admin frame: opens the command palette. */
  onSearch?: () => void;
  homeHref?: string;
  /** What the home button says when it goes somewhere other than home — "Back to orders" on a missing order. */
  homeLabel?: string;
  /** A record page names what is missing — "We can't find this order" — in place of the generic title. */
  title?: string;
  body?: string;
  /** Session expired: where Sign in again goes. */
  signInHref?: string;
  className?: string;
}) {
  const t = useTranslations("screens");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { Icon, tone } = ART[variant];
  const home = homeHref ?? homeFor(surface);
  const homeLabel = homeLabelProp ?? (surface === "go" ? t("homeGo") : t("home"));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference ?? "");
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Blocked clipboard: the code is on screen to read out instead. */
    }
  };

  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      data-status={variant}
      className={cn(
        "flex items-center justify-center px-gutter py-hero",
        framed ? "h-full min-h-96" : "min-h-dvh bg-surface",
        className,
      )}
    >
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <ScreenArt icon={<Icon size={36} strokeWidth={1.5} />} tone={tone} size="lg" />
        <h1 className="mt-major text-2xl font-semibold tracking-title text-fg">{title ?? t(`${variant}.title`)}</h1>
        <p className="mt-tight max-w-sm text-base text-muted">{body ?? t(`${variant}.body`)}</p>

        <div className="mt-major flex w-full flex-col items-stretch justify-center gap-tight sm:w-auto sm:flex-row sm:items-center">
          {variant === "error" && (
            <>
              <Button onClick={onRetry ?? (() => window.location.reload())}>{t("error.retry")}</Button>
              <ButtonLink href={home} variant="secondary">
                {homeLabel}
              </ButtonLink>
            </>
          )}
          {variant === "notFound" && (
            <>
              <ButtonLink href={home} variant="primary">
                {homeLabel}
              </ButtonLink>
              {onSearch && (
                <Button variant="secondary" onClick={onSearch}>
                  {t("notFound.search")}
                </Button>
              )}
              <Button variant="tertiary" icon={<ArrowLeft size={16} strokeWidth={1.5} aria-hidden />} onClick={onBack ?? (() => window.history.back())}>
                {t("notFound.back")}
              </Button>
            </>
          )}
          {variant === "sessionExpired" && (
            <ButtonLink href={signInHref} variant="primary">
              {t("sessionExpired.signIn")}
            </ButtonLink>
          )}
        </div>

        {variant === "error" && reference && (
          <div className="mt-major flex flex-col items-center gap-inline">
            <p className="text-sm text-muted">{t("error.help")}</p>
            <div className="flex items-center gap-tight rounded-control bg-subtle py-inline pl-comfortable pr-inline">
              <span className="sr-only">{t("error.reference")}: </span>
              <code className="font-mono text-sm text-fg">{reference}</code>
              <Button
                size="icon"
                variant="tertiary"
                className={surface === "go" ? "md:h-11 md:w-11" : undefined}
                onClick={copy}
                aria-label={copied ? t("error.copied") : t("error.copy")}
                icon={copied ? <Check size={16} strokeWidth={1.5} aria-hidden /> : <Copy size={16} strokeWidth={1.5} aria-hidden />}
              />
            </div>
            <span role="status" className="sr-only">
              {copied ? t("error.copied") : ""}
            </span>
          </div>
        )}
        {variant === "sessionExpired" && <p className="mt-major max-w-sm text-sm text-muted">{t("sessionExpired.note")}</p>}
      </div>
    </div>
  );
}
