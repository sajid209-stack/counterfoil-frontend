"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { EventTemplate } from "@/components/events/EventTemplate";
import { QuickAddSheet } from "@/app/s/_components/flow/QuickAddSheet";
import { QuickAddToast } from "@/app/s/_components/flow/QuickAddToast";
import { pageView } from "@/lib/api/events";
import type { Product } from "@/lib/api/types";
import { templateFontVars } from "@/lib/events/fonts";
import { countdownOf, pageOf } from "@/lib/productPage";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { PageFrame } from "./PageFrame";
import { useKnowLines, usePageLabels, useWhenWords } from "./pageText";

/**
 * An event's page in one of the six designed looks: the event template, drawn
 * from the item's own record (name, tickets, days and the page fields), so what
 * is previewed in the designer is what a visitor reads.
 *
 * Booking: every "Get tickets" opens the same booking picker the storefront
 * uses, in a sheet, and what it adds is an ordinary line in the basket. In a
 * preview the template is inert — no link leaves the page and nothing opens or
 * writes.
 */
export function EventPage({ product, chrome }: { product: Product; chrome: "storefront" | "link" | "none" }) {
  const flow = useStorefrontFlow();
  const whenText = useWhenWords(product, flow.location);
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
  /* The countdown as the page's settings resolve it, with the words to put over
     it: the operator's own, or plain ones for the kind of countdown it is. */
  const countdown = useMemo(() => {
    const target = countdownOf(product, flow.now);
    if (!target) return null;
    const mode = pageOf(product).countdown?.mode ?? "start";
    return { at: target.at, label: target.label?.trim() || (mode === "date" ? labels.countingDown : labels.startsIn) };
  }, [product, flow.now, labels.countingDown, labels.startsIn]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ name: string; key: number } | null>(null);

  /* The template switches layout on `device`. In a window the viewport decides;
     in the designer the page may sit in a narrow box on a wide screen, so once
     the box has been measured its width wins. */
  const viewportWide = useMediaQuery(MD);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const measure = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    observer.current = ro;
  }, []);
  const wide = boxWidth === null ? viewportWide : boxWidth >= 768;

  const inert = !!flow.inert;

  return (
    <PageFrame product={product} chrome={chrome} bleed>
      {/* The looks' faces travel with the page. The template sets type with the
          `font` shorthand over these variables, and a shorthand naming an
          undefined variable is thrown away whole — so without them a title
          fell back to body size, not just to another face. */}
      <div ref={measure} className={templateFontVars}>
        <EventTemplate
          event={ev}
          device={wide ? "desktop" : "mobile"}
          labels={labels}
          now={flow.now}
          countdown={countdown}
          know={know}
          inert={inert}
          onBook={inert ? undefined : () => setOpen(true)}
        />
      </div>
      {open && !inert && (
        <QuickAddSheet
          product={product}
          hideDetails
          onClose={() => setOpen(false)}
          onAdded={(p) => {
            setOpen(false);
            setToast({ name: p.name, key: Date.now() });
          }}
        />
      )}
      {toast && <QuickAddToast key={toast.key} name={toast.name} onDismiss={() => setToast(null)} />}
    </PageFrame>
  );
}
