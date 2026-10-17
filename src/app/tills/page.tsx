import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo, StatusPill } from "@/components/ui";
import { TILLS } from "@/lib/tills";

export async function generateMetadata() {
  const t = await getTranslations("pos");
  return { title: t("tills.metaTitle") };
}

/**
 * The chooser.
 *
 * Three designs for one job, described in terms of the difference that matters
 * to whoever is reviewing them rather than by version number — "no cart" and
 * "dense row list" are decisions someone can have an opinion about; "v2" is
 * not.
 *
 * Deliberately outside the Go chrome. This is a decision about which till to
 * look at, not a thing a cashier does mid-shift, so it should not appear to be
 * part of a shift.
 */
export default async function TillsPage() {
  const t = await getTranslations("pos");
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-section py-hero">
      <div className="flex items-center justify-between gap-comfortable">
        <Logo size={28} />
        <Link
          href="/"
          className="-my-tight inline-flex min-h-11 items-center gap-inline text-sm text-muted hover:text-ember sm:min-h-0"
        >
          <ArrowLeft size={13} strokeWidth={1.5} aria-hidden /> {t("tills.home")}
        </Link>
      </div>

      <h1 className="type-h1 mt-major text-xl">{t("tills.title")}</h1>
      <p className="type-body mt-tight max-w-xl text-muted">
        {t("tills.intro")}
      </p>

      <div className="mt-major flex flex-col gap-comfortable">
        {TILLS.map((till) =>
          till.ready ? (
            <Link
              key={till.id}
              href={till.href}
              className="card-surface card-interactive group flex items-start gap-comfortable p-card"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-sm text-muted">
                {till.short.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-tight">
                  <span className="type-h2 text-lg">{till.name}</span>
                  <span className="font-mono text-xs text-muted">{till.href}</span>
                </span>
                <span className="type-body mt-inline block text-base text-muted">{till.blurb}</span>
              </span>
              <ArrowRight
                size={18}
                strokeWidth={1.5}
                className="mt-1 shrink-0 text-muted transition-transform duration-quick group-hover:translate-x-0.5 group-hover:text-ember"
              />
            </Link>
          ) : (
            /* Shown, not offered. A variant that is planned but not built says
               so — a link that 404s is worse than an honest placeholder. */
            <div
              key={till.id}
              className="flex items-start gap-comfortable rounded-card border border-dashed border-strong p-card opacity-70"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-subtle font-mono text-sm text-muted">
                {till.short.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-tight">
                  <span className="type-h2 text-lg text-muted">{till.name}</span>
                  <StatusPill tone="neutral">{t("tills.beingBuilt")}</StatusPill>
                </span>
                <span className="type-body mt-inline block text-base text-muted">{till.blurb}</span>
              </span>
            </div>
          ),
        )}
      </div>

      {/* The arrow is an ICON, not part of the string.
          Baked into the label it cannot be styled or animated, it is read
          aloud by a screen reader, and it made the link a 16px-tall target.
          Each row is now a real 44px target on a phone with the glyph
          nudging on hover. */}
      <div className="mt-hero flex flex-wrap items-center gap-major border-t border-line pt-major text-sm text-muted">
        <Link href="/dashboard" className="group inline-flex min-h-11 items-center gap-inline transition-colors duration-quick hover:text-ember sm:min-h-0">{t("tills.osAdmin")}<ArrowRight size={13} strokeWidth={1.75} aria-hidden className="shrink-0 transition-transform duration-quick group-hover:translate-x-0.5" /></Link>
        <Link href="/design-system" className="group inline-flex min-h-11 items-center gap-inline transition-colors duration-quick hover:text-ember sm:min-h-0">{t("tills.tokens")}<ArrowRight size={13} strokeWidth={1.75} aria-hidden className="shrink-0 transition-transform duration-quick group-hover:translate-x-0.5" /></Link>
      </div>
    </main>
  );
}
