"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { Location, Operator } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { PrintToolbar } from "./PrintToolbar";

/**
 * Every A4 document the product prints — sales reports, lists, statements —
 * sits in this frame, so they all read as one family and as the business's own
 * paper rather than as a screenshot of an admin screen:
 *
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [LOGO]  Business name                          SALES REPORT │
 *   │         Venue · address · phone           1 Jul – 29 Jul 26 │
 *   │                                         Filters: Cash, Paid │
 *   ├──────────────────────────────────────────────────────────────┤
 *   │ …the document…                                               │
 *   └──────────────────────────────────────────────────────────────┘
 *     Business — Sales report · Generated 22 Nov 2026 10:04   Page 1 of 3
 *
 * The page footer is drawn in the @page margin (Chrome 131+), so it repeats on
 * every sheet with real page numbers; the letterhead prints once, on page one.
 * `paper` pins the light colours, so a dark-theme operator still prints dark
 * type on white.
 */
export function PrintDocument({
  operator,
  venue,
  title,
  scope,
  lines,
  orientation = "portrait",
  ready = true,
  children,
}: {
  operator?: Pick<Operator, "name" | "logo" | "contactPhone" | "website"> | null;
  venue?: Pick<Location, "name" | "addressLine1" | "city"> | null;
  /** The document's name: "Sales report". */
  title: string;
  /** The one line that says what this covers: a period, a customer, a shift. */
  scope?: string;
  /** Further lines under the scope: the filters, who prepared it. */
  lines?: string[];
  orientation?: "portrait" | "landscape";
  /** False while data loads: the frame shows a placeholder and does not print. */
  ready?: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("exports");
  const generated = useMemo(() => formatDateTime(new Date().toISOString()), []);
  const name = operator?.name || "Counterfoil";
  const address = venue ? [venue.name, [venue.addressLine1, venue.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ") : "";
  const contact = [operator?.contactPhone, operator?.website].filter(Boolean).join(" · ");
  const foot = `${name} — ${title} · ${t("generatedAt", { at: generated })}`.replace(/["\\]/g, "");
  const landscape = orientation === "landscape";

  return (
    <div className="min-h-screen bg-surface px-section py-section print:min-h-0 print:bg-white print:p-0">
      <style>{`@page { size: A4 ${orientation}; margin: 14mm 12mm 16mm; @bottom-left { content: "${foot}"; font: 8pt Inter, Arial, sans-serif; color: #6b6760; } @bottom-right { content: "${t("pageOf")} " counter(page) " / " counter(pages); font: 8pt Inter, Arial, sans-serif; color: #6b6760; } }`}</style>
      <div className={cn("mx-auto", landscape ? "max-w-[297mm]" : "max-w-[210mm]")}>
        <PrintToolbar />
        <article className="paper rounded-md border border-line bg-card p-major text-fg print:rounded-none print:border-0 print:p-0">
          <header className="mb-major flex flex-wrap items-start justify-between gap-x-major gap-y-section border-b-2 border-fg pb-section">
            <div className="flex min-w-0 items-center gap-section">
              {operator?.logo && (
                // eslint-disable-next-line @next/next/no-img-element -- a stored data URL or a path; next/image adds nothing on paper
                <img src={operator.logo} alt="" className="h-14 w-auto max-w-[45mm] shrink-0 object-contain" />
              )}
              <div className="min-w-0">
                <p className="break-words text-md font-semibold leading-tight">{name}</p>
                {address && <p className="mt-0.5 break-words text-xs text-muted">{address}</p>}
                {contact && <p className="break-words text-xs text-muted">{contact}</p>}
              </div>
            </div>
            <div className="min-w-0 text-right max-sm:text-left">
              <h1 className="text-xl font-semibold uppercase tracking-[0.06em]">{title}</h1>
              {scope && <p data-print-scope className="mt-0.5 break-words text-sm font-medium">{scope}</p>}
              {lines?.filter(Boolean).map((l) => (
                <p key={l} className="break-words text-xs text-muted">{l}</p>
              ))}
              <p className="text-xs text-muted print:hidden">{t("generatedAt", { at: generated })}</p>
            </div>
          </header>
          {ready ? children : <div aria-busy="true" className="h-64 animate-pulse rounded-md bg-subtle" />}
        </article>
      </div>
    </div>
  );
}
