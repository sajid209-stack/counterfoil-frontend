"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Mail, MapPin, Phone, ShoppingBag } from "lucide-react";
import { LogoMark } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { AccentColor, Location, Storefront } from "@/lib/api";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { SfRoot } from "./sf";

/** The container every storefront section sits in. */
export const WRAP = "mx-auto w-full max-w-[1200px] px-gutter";

/**
 * The accent a venue paints its page in. Kept as exports because the editor's
 * colour picker still reads them; the page itself is themed through the `.sf`
 * scope (lib/storefront/theme.ts), where the accent is a button colour, a link
 * colour and a small mark, never a wash behind content.
 */
export const ACCENT_BG: Record<AccentColor, string> = {
  orange: "bg-cat-orange",
  amber: "bg-cat-amber",
  green: "bg-cat-green",
  blue: "bg-cat-blue",
  rose: "bg-cat-rose",
};

const TITLES = new Set(["the", "of", "and", "a"]);
/** Two letters for the logo tile: "Lalbagh Fort" is LF. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w && !TITLES.has(w.toLowerCase()));
  if (!words.length) return "";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/** The one place a venue's address becomes a maps link. */
export function directionsHref(location: Location): string {
  const q = [location.name, location.addressLine1, location.addressLine2, location.city, location.country].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * The frame every public venue page sits in.
 *
 * Deliberately NOT the OS shell: a visitor has no rail, no account and no
 * settings. What they get is a sticky header (the venue, What's on, Visit and
 * the basket), the page, and a footer with the venue's details and, small, who
 * runs the software.
 *
 * `current` says whether the page is the venue's own, because "What's on" and
 * "Visit" scroll on it and go to it from anywhere else.
 */
export function StorefrontChrome({
  storefront,
  location,
  poweredBy,
  current = "other",
  children,
}: {
  storefront: Storefront;
  location: Location;
  poweredBy: string;
  current?: "venue" | "other";
  /** Kept so callers can say what they used to; the header no longer carries
   *  a back link, a breadcrumb in the page does (see `BackLink`). */
  backHref?: string;
  backLabel?: string;
  preview?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const preview = flow.mode === "preview";
  const slug = storefront.slug;
  const mark = initials(location.name);

  const brand = (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--sf-fill)] text-[14px] font-semibold tracking-[0.02em] text-[var(--sf-on-fill)]"
      >
        {mark}
      </span>
      <span className="min-w-0 truncate text-[16px] font-semibold tracking-[-0.01em]">{location.name}</span>
    </>
  );
  const brandCls = "flex min-h-11 min-w-0 items-center gap-comfortable rounded-[10px]";

  const jump = (id: string) => (e: React.MouseEvent<HTMLElement>) => {
    const doc = e.currentTarget.ownerDocument;
    if (current === "venue") {
      e.preventDefault();
      doc.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (preview) {
      flow.goVenue();
      setTimeout(() => doc.getElementById(id)?.scrollIntoView({ block: "start" }), 120);
    }
  };
  const navCls =
    "flex min-h-11 items-center rounded-[10px] px-comfortable text-[14px] font-medium text-fg transition-colors duration-quick hover:bg-subtle";
  const navItem = (id: string, label: string) =>
    preview ? (
      <button key={id} type="button" onClick={jump(id)} className={navCls}>
        {label}
      </button>
    ) : (
      <Link key={id} href={`/s/${slug}#${id}`} onClick={jump(id)} className={navCls}>
        {label}
      </Link>
    );

  const basketInner = (
    <>
      <ShoppingBag size={20} strokeWidth={1.75} aria-hidden />
      <span className="hidden sm:inline">{t("basket.label")}</span>
      {flow.itemCount > 0 && (
        <span className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-fill)] px-1 text-[12px] font-semibold leading-none text-[var(--sf-on-fill)]">
          {flow.itemCount}
        </span>
      )}
    </>
  );
  const basketCls =
    "relative flex min-h-11 min-w-11 items-center justify-center gap-tight rounded-[10px] border border-line px-comfortable text-[14px] font-medium text-fg transition-colors duration-quick hover:border-strong";
  const basketLabel = t("basket.ariaLabel", { count: flow.itemCount });

  return (
    <SfRoot accent={storefront.accent} className="flex flex-col">
      <header className="sticky top-0 z-50 border-b border-hairline bg-white/95 backdrop-blur" data-sf-header>
        <div className={cn(WRAP, "flex h-16 items-center gap-section")}>
          {preview ? (
            <button type="button" onClick={flow.goVenue} className={cn(brandCls, "text-left")}>
              {brand}
            </button>
          ) : (
            <Link href={`/s/${slug}`} className={brandCls}>
              {brand}
            </Link>
          )}
          <nav aria-label={location.name} className="ml-major hidden items-center gap-inline sm:flex">
            {navItem("whats-on", t("whatsOn"))}
            {navItem("visit", t("nav.visit"))}
          </nav>
          <div className="ml-auto">
            {preview ? (
              <button type="button" onClick={flow.goBasket} aria-label={basketLabel} className={basketCls}>
                {basketInner}
              </button>
            ) : (
              <Link href={`/s/${slug}/basket`} aria-label={basketLabel} className={basketCls}>
                {basketInner}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={cn(WRAP, "w-full flex-1 pb-hero")}>{children}</main>

      <footer className="border-t border-hairline bg-subtle">
        <div className={cn(WRAP, "grid grid-cols-1 gap-major py-major sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]")}>
          <div className="min-w-0">
            <p className="text-[16px] font-semibold">{location.name}</p>
            <p className="mt-tight flex items-start gap-tight text-[14px] text-muted">
              <MapPin size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" aria-hidden />
              <span>{[location.addressLine1, location.addressLine2, location.city].filter(Boolean).join(", ")}</span>
            </p>
          </div>
          <div className="min-w-0 text-[14px]">
            <p className="font-semibold">{t("footer.contact")}</p>
            <ul className="mt-tight flex flex-col gap-inline text-muted">
              {storefront.contactPhone && (
                <li className="flex items-center gap-tight">
                  <Phone size={16} strokeWidth={1.5} aria-hidden />
                  <a href={`tel:${storefront.contactPhone}`} className="inline-flex min-h-11 items-center hover:text-fg hover:underline sm:min-h-0">
                    {storefront.contactPhone}
                  </a>
                </li>
              )}
              {storefront.contactEmail && (
                <li className="flex items-center gap-tight">
                  <Mail size={16} strokeWidth={1.5} aria-hidden />
                  <a href={`mailto:${storefront.contactEmail}`} className="inline-flex min-h-11 items-center break-all hover:text-fg hover:underline sm:min-h-0">
                    {storefront.contactEmail}
                  </a>
                </li>
              )}
              {!storefront.contactPhone && !storefront.contactEmail && <li>{t("footer.noContact")}</li>}
            </ul>
          </div>
          {storefront.links.length > 0 && (
            <div className="min-w-0 text-[14px]">
              <p className="font-semibold">{t("footer.links")}</p>
              <ul className="mt-tight flex flex-col gap-inline">
                {storefront.links.map((l) => (
                  <li key={l.id}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-h-11 items-center text-[var(--sf-ink)] underline-offset-4 hover:underline sm:min-h-0"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-hairline">
          <div className={cn(WRAP, "flex items-center gap-tight py-section text-[12px] text-muted")}>
            <LogoMark size={16} />
            {poweredBy}
          </div>
        </div>
      </footer>
    </SfRoot>
  );
}

/** "‹ Everything at Lalbagh Fort": a link on the live page (so back works and
 *  the address is shareable) and a flow step inside the editor's preview. */
export function BackLink({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const flow = useStorefrontFlow();
  const cls =
    "-ml-tight inline-flex min-h-11 items-center gap-tight rounded-[10px] px-tight text-[14px] font-medium text-muted transition-colors duration-quick hover:text-fg";
  if (flow.mode === "preview" || !href) {
    return (
      <button type="button" onClick={onClick ?? flow.goVenue} className={cls}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <Link href={href} className={cls}>
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      {label}
    </Link>
  );
}

/** What a visitor is told when an address does not resolve. Unpublished and
 *  never-existed look identical on purpose: a draft page must not be findable
 *  by guessing, and "not published yet" tells a guesser they are close. */
export function StorefrontMissing({ title, message }: { title: string; message: string }) {
  return (
    <SfRoot accent={null} className="flex items-center justify-center px-section">
      <div className="max-w-sm text-center">
        <LogoMark size={28} className="mx-auto" />
        <h1 className="mt-section text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mt-tight text-[16px] text-muted">{message}</p>
      </div>
    </SfRoot>
  );
}
