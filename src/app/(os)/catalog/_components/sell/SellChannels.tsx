"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, EyeOff, ExternalLink, Globe, Link2, Plus } from "lucide-react";
import { Button, ButtonLink, Checkbox, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Location } from "@/lib/api";
import { freeSlugFor, isSlugFree, isSlugValid } from "@/lib/api/products";

/** The three online answers. "off" is "Not online": no "online" channel. */
export type OnlineChoice = "listed" | "link" | "off";

export interface SellChannelsProps {
  /** Sold at the counter. */
  counter: boolean;
  onCounter: (next: boolean) => void;
  /** Online: on the storefront, only by its link, or not at all. */
  online: OnlineChoice;
  onOnline: (next: OnlineChoice) => void;
  /** The item's link name, the part after /b/. */
  slug: string;
  onSlug: (next: string) => void;
  /** The saved item, so its own link is not "taken" by itself. Absent in the wizard. */
  productId?: string;
  /** The item's name, to make a link from when online is first turned on. */
  name: string;
  /** Venues answer two questions: whose counters sell it, and whose storefront lists it. */
  locations: Location[];
  locationIds: string[];
  onToggleLocation: (id: string) => void;
  onAddLocation?: () => void;
  /** A problem the parent found, usually "pick a venue". */
  error?: string | null;
  /** Tighter spacing for a narrow wizard column. */
  compact?: boolean;
}

const MAX_SLUG = 60;
const noop = () => () => {};

/**
 * Where an item is sold (docs/catalog.md section 9.3): at the counter, and
 * online in one of three ways, with the item's own link. One block for the
 * wizard and the record page tab; it lays out from its own width (container
 * queries), not the screen's, so it fits a narrow wizard column and a wide tab.
 */
export function SellChannels({
  counter,
  onCounter,
  online,
  onOnline,
  slug,
  onSlug,
  productId,
  name,
  locations,
  locationIds,
  onToggleLocation,
  onAddLocation,
  error,
  compact = false,
}: SellChannelsProps) {
  const t = useTranslations("catalog.sell");
  const group = useId();
  const slugId = useId();
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "");
  const host = origin.replace(/^https?:\/\//, "");
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOnline = online !== "off";
  const venuesNeeded = counter || online === "listed";
  const clean = slug.trim();
  const slugError = !isOnline
    ? null
    : clean === ""
      ? t("slugEmpty")
      : clean.length > MAX_SLUG
        ? t("slugLong", { max: MAX_SLUG })
        : !isSlugValid(clean)
          ? t("slugInvalid")
          : !isSlugFree(clean, productId)
            ? t("slugTaken")
            : null;
  const nothing = !counter && online === "off";
  const chosen = locations.filter((l) => locationIds.includes(l.id));

  const pickOnline = (next: OnlineChoice) => {
    // Turning online on makes a link from the name, so the row below is never
    // an empty box the operator has to think up.
    if (next !== "off" && clean === "") onSlug(freeSlugFor(name, productId));
    onOnline(next);
  };

  const fullLink = `${origin}/b/${clean}`;
  const copy = async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
    timer.current = setTimeout(() => setCopied("no"), 2500);
  };

  const options: { value: OnlineChoice; label: string; help: string; icon: React.ReactNode }[] = [
    { value: "listed", label: t("listed"), help: t("listedHelp"), icon: <Globe size={18} strokeWidth={1.5} aria-hidden /> },
    { value: "link", label: t("link"), help: t("linkHelp"), icon: <Link2 size={18} strokeWidth={1.5} aria-hidden /> },
    { value: "off", label: t("off"), help: t("offHelp"), icon: <EyeOff size={18} strokeWidth={1.5} aria-hidden /> },
  ];

  const venueHelp = counter && online === "listed" ? t("venuesBoth") : counter ? t("venuesCounter") : t("venuesListed");

  return (
    <div className={cn("@container flex flex-col", compact ? "gap-section" : "gap-major")}>
      {/* At the counter */}
      <section aria-labelledby={`${group}-counter`} className="flex flex-col gap-tight">
        <h3 id={`${group}-counter`} className="text-md font-semibold text-fg">{t("counterTitle")}</h3>
        <Switch
          checked={counter}
          onChange={onCounter}
          label={counter ? t("counterOn") : t("counterOff")}
          description={counter ? t("counterOnHelp") : t("counterOffHelp")}
        />
      </section>

      {/* Online */}
      <section aria-labelledby={`${group}-online`} className="flex flex-col gap-tight">
        <h3 id={`${group}-online`} className="text-md font-semibold text-fg">{t("onlineTitle")}</h3>
        <div
          role="radiogroup"
          aria-labelledby={`${group}-online`}
          aria-invalid={nothing || undefined}
          aria-describedby={nothing ? `${group}-nothing` : undefined}
          className="grid gap-tight @2xl:grid-cols-3"
        >
          {options.map((o) => (
            <label
              key={o.value}
              className={cn(
                "relative flex min-h-11 cursor-pointer items-start gap-comfortable rounded-card border bg-card transition-colors duration-quick ease-counterfoil",
                compact ? "p-comfortable" : "p-card",
                "border-line hover:border-strong",
                "has-checked:border-ember has-checked:bg-ember-wash has-checked:ring-1 has-checked:ring-inset has-checked:ring-ember",
                "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
              )}
            >
              {/* A native radio group: one tab stop, the arrow keys move and choose. */}
              <input
                type="radio"
                name={group}
                value={o.value}
                checked={online === o.value}
                onChange={() => pickOnline(o.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "relative mt-inline h-5 w-5 shrink-0 rounded-full border border-strong bg-card transition-colors duration-quick",
                  "peer-checked:border-ember-solid peer-checked:bg-ember-solid",
                  "after:absolute after:left-1/2 after:top-1/2 after:h-2 after:w-2 after:-translate-x-1/2 after:-translate-y-1/2 after:scale-0 after:rounded-full after:bg-on-solid after:transition-transform after:duration-quick peer-checked:after:scale-100",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-tight text-base font-medium text-fg">
                  <span className="shrink-0 text-muted">{o.icon}</span>
                  {o.label}
                </span>
                <span className="mt-inline block text-sm text-muted">{o.help}</span>
              </span>
            </label>
          ))}
        </div>
        {nothing && (
          <p id={`${group}-nothing`} role="alert" className="text-sm font-medium text-danger">
            {t("nowhere")}
          </p>
        )}
      </section>

      {/* Venues */}
      {venuesNeeded && (
        <fieldset className="flex min-w-0 flex-col gap-tight" aria-invalid={error ? true : undefined} aria-describedby={error ? `${group}-venue-error` : undefined}>
          <legend className="mb-tight text-md font-semibold text-fg">{t("venues")}</legend>
          <p className="text-sm text-muted">{venueHelp}</p>
          {locations.length === 0 ? (
            <div className="rounded-inner bg-muted-wash px-comfortable py-section text-center">
              <p className="text-sm text-muted">{t("noVenue")}</p>
              {onAddLocation && (
                <Button size="sm" className="mt-tight" icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} onClick={onAddLocation}>
                  {t("addVenue")}
                </Button>
              )}
            </div>
          ) : (
            <>
              {locations.map((l) => (
                <Checkbox key={l.id} label={l.name} checked={locationIds.includes(l.id)} onCheckedChange={() => onToggleLocation(l.id)} />
              ))}
              {onAddLocation && (
                <Button variant="tertiary" size="sm" className="mt-inline self-start" icon={<Plus size={14} strokeWidth={1.5} aria-hidden />} onClick={onAddLocation}>
                  {t("addVenue")}
                </Button>
              )}
            </>
          )}
          {error && (
            <p id={`${group}-venue-error`} role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
        </fieldset>
      )}

      {/* Its link */}
      {isOnline && (
        <section aria-labelledby={`${group}-link`} className="flex flex-col gap-tight">
          <h3 id={`${group}-link`} className="text-md font-semibold text-fg">{t("linkTitle")}</h3>
          <div className="flex flex-col gap-tight @2xl:flex-row @2xl:items-start">
            <div className="min-w-0 flex-1">
              <div
                data-focus-host=""
                className={cn(
                  "flex h-11 min-w-0 items-center rounded-control border bg-card transition-colors duration-quick ease-counterfoil",
                  "has-focus-visible:outline has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                  slugError ? "border-danger" : "border-line hover:border-strong focus-within:border-ember",
                )}
              >
                <span className="shrink truncate pl-comfortable font-mono text-sm text-muted" title={`${host}/b/`}>
                  {host}/b/
                </span>
                <input
                  id={slugId}
                  type="text"
                  value={slug}
                  onChange={(e) => onSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                  aria-label={t("slugLabel")}
                  aria-invalid={slugError ? true : undefined}
                  aria-describedby={`${slugId}-msg`}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-full min-w-24 flex-1 bg-transparent pr-comfortable font-mono text-sm text-fg placeholder:text-faint"
                />
              </div>
              <p id={`${slugId}-msg`} className={cn("mt-inline text-xs", slugError ? "font-medium text-danger" : "text-muted")}>
                {slugError ?? t("slugOk")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-tight">
              <Button
                variant="secondary"
                disabled={!!slugError}
                onClick={copy}
                icon={copied === "yes" ? <Check size={16} strokeWidth={2} aria-hidden /> : <Copy size={16} strokeWidth={1.5} aria-hidden />}
              >
                {copied === "yes" ? t("copied") : t("copy")}
              </Button>
              {productId &&
                (slugError ? (
                  <Button variant="secondary" disabled icon={<ExternalLink size={16} strokeWidth={1.5} aria-hidden />}>
                    {t("open")}
                  </Button>
                ) : (
                  <ButtonLink variant="secondary" href={`/b/${clean}`} target="_blank" rel="noopener noreferrer" icon={<ExternalLink size={16} strokeWidth={1.5} aria-hidden />}>
                    {t("open")}
                  </ButtonLink>
                ))}
            </div>
          </div>
          <p className="sr-only" role="status">{copied === "yes" ? t("copied") : ""}</p>
          {copied === "failed" && <p role="alert" className="text-sm text-danger">{t("copyFailed")}</p>}
          {slugError && <p className="text-xs text-muted">{t("buttonsWhy")}</p>}
          {!productId && !slugError && <p className="text-xs text-muted">{t("openLater")}</p>}

          {online === "listed" ? (
            chosen.length > 0 ? (
              <ul className="flex flex-col gap-inline">
                {chosen.map((l) => (
                  <li key={l.id} className="text-sm text-fg">{t("listedOn", { venue: l.name })}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("listedNone")}</p>
            )
          ) : (
            <p className="text-sm text-muted">{t("linkOnlyNote")}</p>
          )}
        </section>
      )}
    </div>
  );
}
