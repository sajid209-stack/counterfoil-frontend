"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { QuickAddSheet } from "@/app/s/_components/flow/QuickAddSheet";
import { QuickAddToast } from "@/app/s/_components/flow/QuickAddToast";
import { pageView } from "@/lib/api/events";
import type { Product } from "@/lib/api/types";
import { templateFontVars } from "@/lib/events/fonts";
import { fromPriceOf } from "@/lib/price";
import { countdownOf, pageOf } from "@/lib/productPage";
import { ACCENT_HEX } from "@/lib/storefront/theme";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { PageFrame } from "../PageFrame";
import { useKnowLines, usePageLabels, useWhenWords } from "../pageText";
import { BookingPanel, type PanelPick } from "./BookingPanel";
import { PageContext, type PageCtx } from "./context";
import { FactsStrip } from "./FactsStrip";
import { Hero } from "./Hero";
import { BOOK_BAR_H, MobileBookBar } from "./MobileBookBar";
import { SectionNav } from "./SectionNav";
import { BODY_SECTIONS } from "./sections";
import { TicketOptions } from "./TicketOptions";
import { lookOf, pageRootClass, pageVars } from "./theme";

/**
 * A booking's page — ONE renderer for every booking and every look
 * (docs/product-page.md). It builds the page context once and composes:
 *
 *   hero → key facts → [section bar, once the hero has gone]
 *   body (the sections in the operator's order, tickets where they sit)
 *     beside the booking panel on a desktop
 *   → the phone's bottom bar
 *
 * Which of those is drawn follows the width of the page's OWN box
 * (`ctx.layout`), not the screen's, so the designer's phone preview inside a
 * wide window lays out as a phone.
 */
export function BookingPage({ product, chrome }: { product: Product; chrome: "storefront" | "link" | "none" }) {
  const flow = useStorefrontFlow();
  const whenText = useWhenWords(product, flow.location);
  const page = pageOf(product);
  const look = lookOf(page.look);
  const ev = useMemo(
    () =>
      pageView(product, {
        now: flow.now,
        whenText: whenText || undefined,
        venue: { name: flow.location.name, address: [flow.location.addressLine1, flow.location.city].filter(Boolean).join(", ") },
      }),
    [product, flow.now, flow.location, whenText],
  );
  const labels = usePageLabels(ev.categoryId);
  const know = useKnowLines(product);
  /* Cheap, and the React Compiler memoises it; written plainly. */
  const target = countdownOf(product, flow.now);
  const countdownMode = page.countdown?.mode ?? "start";
  const countdown = target
    ? { at: target.at, label: target.label?.trim() || (countdownMode === "date" ? labels.countingDown : labels.startsIn) }
    : null;

  /* The page lays out by the width of its OWN box, so the designer's phone
     preview on a wide screen lays out as a phone. Measured as soon as the box
     exists (so a phone never flashes the desktop layout) and again on resize. */
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    observer.current = ro;
  }, []);
  const layout: PageCtx["layout"] = width === null ? "desktop" : width >= 1024 ? "desktop" : width >= 768 ? "tablet" : "phone";

  const inert = !!flow.inert;
  const [sheet, setSheet] = useState<{ tierId?: string } | null>(null);
  const [toast, setToast] = useState<{ name: string; key: number } | null>(null);
  const [pick, setPick] = useState<PanelPick>({ n: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const heroEnd = useRef<HTMLDivElement>(null);

  const book = (tierId?: string) => {
    if (inert) return;
    const panel = panelRef.current;
    if (layout === "desktop" && panel) {
      /* "Choose" on a ticket card remounts the panel's picker with that ticket
         already chosen; a plain "book" just brings the panel into view. */
      if (tierId) setPick((p) => ({ tierId, n: p.n + 1 }));
      const win = panel.ownerDocument.defaultView;
      const calm = !!win?.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panel.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest" });
      win?.requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), [tabindex]")?.focus({ preventScroll: true });
      });
      return;
    }
    setSheet({ tierId });
  };

  const accent = page.accent ?? look.accent ?? (flow.storefront.accent ? ACCENT_HEX[flow.storefront.accent] : null) ?? "#161616";
  const sections = (ev.customisation.pageSections ?? page.sections).filter((s) => page.sections.includes(s));

  const ctx: PageCtx = {
    product,
    ev,
    page,
    look,
    labels,
    know,
    countdown,
    now: flow.now,
    layout,
    inert,
    book,
    sections,
    location: flow.location,
    from: fromPriceOf(product, flow.now),
  };

  const desktop = layout === "desktop";

  return (
    <PageFrame product={product} chrome={chrome} bleed>
      <PageContext.Provider value={ctx}>
        <div
          ref={measure}
          className={`${templateFontVars} ${pageRootClass(look)}`}
          style={{
            ...pageVars(look, accent),
            /* The phone's bottom bar is fixed; the page reserves its height. */
            paddingBottom: desktop ? undefined : `calc(${BOOK_BAR_H}px + env(safe-area-inset-bottom))`,
          }}
        >
          <Hero />
          <div ref={heroEnd} aria-hidden style={{ height: 1, marginTop: -1 }} />
          <SectionNav sentinelRef={heroEnd} />
          <FactsStrip />

          <div className="pg-container pb-16 pt-8 md:pt-10">
            <div className={desktop ? "grid items-start" : undefined} style={desktop ? { gridTemplateColumns: "minmax(0, 1fr) 380px", columnGap: 48 } : undefined}>
              <div className="min-w-0">
                {sections.map((id) => {
                  if (id === "tickets") return <TicketOptions key={id} />;
                  const C = BODY_SECTIONS[id];
                  return C ? <C key={id} /> : null;
                })}
              </div>
              {desktop && <BookingPanel panelRef={panelRef} pick={pick} onAdded={() => setToast({ name: product.name, key: Date.now() })} />}
            </div>
          </div>

          {!desktop && <MobileBookBar />}
        </div>
        {sheet && !inert && (
          <QuickAddSheet
            product={product}
            hideDetails
            preselectTierId={sheet.tierId}
            onClose={() => setSheet(null)}
            onAdded={(p) => {
              setSheet(null);
              setToast({ name: p.name, key: Date.now() });
            }}
          />
        )}
        {toast && <QuickAddToast key={toast.key} name={toast.name} onDismiss={() => setToast(null)} />}
      </PageContext.Provider>
    </PageFrame>
  );
}
