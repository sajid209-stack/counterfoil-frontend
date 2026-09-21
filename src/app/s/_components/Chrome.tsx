"use client";

import Link from "next/link";
import { LogoMark } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { CategoryColor, Location, Storefront } from "@/lib/api";

/**
 * The accent a venue paints its page in. The same five the calendar's
 * categories use, so a storefront cannot be given a hue that failed the
 * palette checks — see globals.css for how they were measured.
 *
 * A FILL and a rule, never a letterform. Those five steps were validated as
 * marks against a surface, not as text on one: measured here, the accent on
 * its own 12% wash came to 3.4:1 on the line stating today's hours. It is the
 * rule this product has paid for twice — `ember` is right as a fill and wrong
 * as a letter — so the page's words stay on the theme's ink tokens and links
 * take `brand-foreground`, which was chosen for exactly this.
 */
export const ACCENT_BG: Record<CategoryColor, string> = {
  orange: "bg-cat-orange",
  amber: "bg-cat-amber",
  green: "bg-cat-green",
  blue: "bg-cat-blue",
  rose: "bg-cat-rose",
};
/** A wash, written as an alpha for the same reason the calendar's blocks are:
 *  14% of a mid-toned hue is a pastel over paper and a tint dropped into the
 *  card over ink, which is the project's dark rule, in one declaration. */
export const ACCENT_WASH: Record<CategoryColor, string> = {
  orange: "bg-cat-orange/12",
  amber: "bg-cat-amber/14",
  green: "bg-cat-green/12",
  blue: "bg-cat-blue/12",
  rose: "bg-cat-rose/12",
};

/**
 * The frame every public venue page sits in.
 *
 * Deliberately NOT the OS shell: a visitor has no rail, no account and no
 * settings, and giving them one would be showing the operator's furniture to
 * the public. What they get is the venue's name, a way back to it, and — at
 * the very bottom, small — who runs the software.
 */
export function StorefrontChrome({
  storefront,
  location,
  backHref,
  backLabel,
  poweredBy,
  children,
}: {
  storefront: Storefront;
  location: Location;
  /** Present on a booking's page, absent on the venue's own. */
  backHref?: string;
  backLabel?: string;
  poweredBy: string;
  children: React.ReactNode;
}) {
  const accent = storefront.accent ?? null;
  return (
    <div className="min-h-screen bg-surface text-fg">
      <header className="border-b border-hairline bg-card/60">
        <div className="mx-auto flex max-w-5xl items-center gap-comfortable px-section py-comfortable sm:px-major">
          {/* 44px on a phone. These are the only two navigation controls a
              visitor has, and a 23px text link is not a target on a touch
              screen — the inline-link exemption is for links inside prose,
              which these are not. */}
          <Link href={`/s/${storefront.slug}`} className="-ml-tight flex min-h-11 min-w-0 items-center gap-tight rounded-sm px-tight sm:ml-0 sm:min-h-0 sm:px-0">
            {accent && <span aria-hidden className={cn("h-5 w-1 shrink-0 rounded-full", ACCENT_BG[accent])} />}
            <span className="min-w-0 truncate text-[15px] font-semibold">{location.name}</span>
          </Link>
          {backHref && (
            <Link
              href={backHref}
              className="ml-auto flex min-h-11 shrink-0 items-center rounded-sm px-tight text-[13px] text-muted underline-offset-4 transition-colors duration-quick hover:text-fg hover:underline sm:min-h-0 sm:py-inline"
            >
              {backLabel}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-section pb-hero pt-section sm:px-major">{children}</main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-5xl items-center gap-tight px-section py-comfortable text-[12px] text-muted sm:px-major">
          <LogoMark size={16} />
          {poweredBy}
        </div>
      </footer>
    </div>
  );
}

/** What a visitor is told when an address does not resolve. Unpublished and
 *  never-existed look identical on purpose: a draft page must not be findable
 *  by guessing, and "not published yet" tells a guesser they are close. */
export function StorefrontMissing({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-section text-fg">
      <div className="max-w-sm text-center">
        <LogoMark size={28} className="mx-auto" />
        <h1 className="type-h1 mt-section text-[22px]">{title}</h1>
        <p className="mt-tight text-[14px] text-muted">{message}</p>
      </div>
    </div>
  );
}
