"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink, Globe, Link2, Store } from "lucide-react";
import { Button, ButtonLink, Card, Notice } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Location, Product, ProductPage } from "@/lib/api";
import { isSlugFree, isSlugValid } from "@/lib/api/products";
import { PageDesigner } from "../page/PageDesigner";
import { SellChannels, type OnlineChoice } from "../sell/SellChannels";

const noop = () => () => {};

/** The site's origin, empty on the server, so a link can be written in full once the browser has taken over. */
export const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

/** The item's own link, in full, when it is sold online. */
export const itemUrl = (origin: string, slug: string) => `${origin}/b/${slug}`;

/** Copy text to the clipboard; false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ── Where it's sold ─────────────────────────────────────────────────────── */

export type WhereProblem = "nowhere" | "venue" | "slug" | null;

/**
 * What stops the "where it's sold" answers being saved, in the order the screen
 * shows them. The save bar is never greyed out without saying why, so the tab
 * puts the same reason beside the field it is about.
 */
export function whereProblem(w: { counter: boolean; online: OnlineChoice; locationIds: string[]; slug: string }, productId: string): WhereProblem {
  if (!w.counter && w.online === "off") return "nowhere";
  if ((w.counter || w.online === "listed") && w.locationIds.length === 0) return "venue";
  if (w.online !== "off") {
    const slug = w.slug.trim();
    if (!slug || slug.length > 60 || !isSlugValid(slug) || !isSlugFree(slug, productId)) return "slug";
  }
  return null;
}

export function WhereTab({
  productId,
  name,
  counter,
  online,
  slug,
  locations,
  locationIds,
  onCounter,
  onOnline,
  onSlug,
  onToggleLocation,
}: {
  productId: string;
  name: string;
  counter: boolean;
  online: OnlineChoice;
  slug: string;
  locations: Location[];
  locationIds: string[];
  onCounter: (next: boolean) => void;
  onOnline: (next: OnlineChoice) => void;
  onSlug: (next: string) => void;
  onToggleLocation: (id: string) => void;
}) {
  const ts = useTranslations("catalog.sell");
  const problem = whereProblem({ counter, online, locationIds, slug }, productId);
  return (
    <Card>
      <SellChannels
        counter={counter}
        onCounter={onCounter}
        online={online}
        onOnline={onOnline}
        slug={slug}
        onSlug={onSlug}
        productId={productId}
        name={name}
        locations={locations}
        locationIds={locationIds}
        onToggleLocation={onToggleLocation}
        error={problem === "venue" ? (counter && online === "listed" ? ts("venuesBoth") : counter ? ts("venuesCounter") : ts("venuesListed")) : null}
      />
    </Card>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export function PageTab({
  draft,
  page,
  online,
  onPage,
  onDescription,
  onEditDetails,
  onEditTickets,
  onGoWhere,
}: {
  /** The item as it stands now, unsaved edits included, for the live preview. */
  draft: Product;
  page: ProductPage;
  online: OnlineChoice;
  onPage: (next: ProductPage) => void;
  onDescription: (next: string) => void;
  onEditDetails: () => void;
  onEditTickets: () => void;
  onGoWhere: () => void;
}) {
  const t = useTranslations("catalog.item");
  /* Sections still showing seeded words nobody has confirmed. */
  const samples = (page.samples ?? []).filter((s) => page.sections.includes(s));
  return (
    <div className="flex flex-col gap-section">
      {online === "off" && (
        <Notice tone="info" title={t("pageOffline")} action={{ label: t("pageOfflineFix"), onClick: onGoWhere }}>
          {t("pageOfflineBody")}
        </Notice>
      )}
      {online !== "off" && samples.length > 0 && (
        <Notice tone="warning" title={t("pageSamples", { count: samples.length })}>
          {t("pageSamplesBody")}
        </Notice>
      )}
      <PageDesigner product={draft} page={page} onPage={onPage} onDescription={onDescription} onEditDetails={onEditDetails} onEditTickets={onEditTickets} />
    </div>
  );
}

/* ── Its link ────────────────────────────────────────────────────────────── */

/**
 * "Its link": the address a customer can book at, with Copy and Open, and where
 * the item is listed. An item that is not sold online has no page and no link,
 * and says so, with the way to change it.
 */
export function ItsLink({
  slug,
  online,
  counter,
  locations,
  locationIds,
  saved,
  onSellOnline,
  className,
}: {
  slug: string;
  online: OnlineChoice;
  counter: boolean;
  locations: Location[];
  locationIds: string[];
  /** The link only works once the item is saved with this answer. */
  saved: boolean;
  onSellOnline: () => void;
  className?: string;
}) {
  const t = useTranslations("catalog.item");
  const ts = useTranslations("catalog.sell");
  const origin = useOrigin();
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const venues = locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name);
  const url = itemUrl(origin, slug);

  const copy = async () => {
    if (timer.current) clearTimeout(timer.current);
    setCopied((await copyText(url)) ? "yes" : "failed");
    timer.current = setTimeout(() => setCopied("no"), 2500);
  };

  return (
    <Card as="section" title={t("link.title")} className={className}>
      {online === "off" ? (
        <div className="flex flex-col gap-comfortable">
          <p className="flex items-start gap-tight text-sm text-muted">
            <Store size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0" />
            <span>{counter ? t("link.counterOnly", { venues: venues.join(", ") || t("link.noVenue") }) : t("link.nowhere")}</span>
          </p>
          <Button variant="secondary" className="self-start" onClick={onSellOnline}>
            {t("link.sellOnline")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-comfortable">
          <p className="flex items-start gap-tight text-sm">
            {online === "listed" ? <Globe size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-muted" /> : <Link2 size={16} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-muted" />}
            <span className="min-w-0 break-all font-mono text-sm text-fg">{url.replace(/^https?:\/\//, "")}</span>
          </p>
          <div className="flex flex-wrap gap-tight">
            <Button
              variant="secondary"
              onClick={copy}
              icon={copied === "yes" ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={1.5} aria-hidden />}
            >
              {copied === "yes" ? ts("copied") : ts("copy")}
            </Button>
            {saved ? (
              <ButtonLink variant="secondary" href={`/b/${slug}`} target="_blank" rel="noopener noreferrer" icon={<ExternalLink size={16} strokeWidth={1.5} aria-hidden />}>
                {ts("open")}
              </ButtonLink>
            ) : (
              <Button variant="secondary" disabled icon={<ExternalLink size={16} strokeWidth={1.5} aria-hidden />}>
                {ts("open")}
              </Button>
            )}
          </div>
          {!saved && <p className="text-xs text-muted">{t("link.saveFirst")}</p>}
          {copied === "failed" && <p role="alert" className="text-sm text-danger">{ts("copyFailed")}</p>}
          <p className={cn("text-sm", online === "listed" && venues.length ? "text-fg" : "text-muted")}>
            {online === "listed"
              ? venues.length
                ? t("link.listedOn", { venues: venues.join(", ") })
                : ts("listedNone")
              : ts("linkOnlyNote")}
          </p>
          {counter && venues.length > 0 && <p className="text-sm text-muted">{t("link.counterAt", { venues: venues.join(", ") })}</p>}
        </div>
      )}
      <p className="sr-only" role="status">{copied === "yes" ? ts("copied") : ""}</p>
    </Card>
  );
}
