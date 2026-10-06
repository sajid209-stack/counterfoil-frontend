"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/api";
import { formatDuration } from "@/lib/duration";
import { productMinutes } from "@/lib/storefront/facts";
import { useStorefrontFlow } from "@/lib/storefront/FlowProvider";
import type { BasketLine } from "@/lib/storefront/basket";
import { Media, typeGroup } from "../sf";
import { BookingPicker } from "./BookingPicker";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Quick add: the booking's own questions in a sheet over the list, so the
 * common purchase never leaves it.
 *
 * Phone: a bottom sheet (handle, swipe down, backdrop and Escape close it).
 * Tablet and up: a drawer from the right, about 440px wide. Either way it is
 * the SAME `BookingPicker` the full page uses, handed two hooks, so the two
 * cannot ask different questions. It opens ready (first open day, first time
 * with room, one ticket) and "Add to basket" is the primary button.
 *
 * It is rendered in the tree rather than portalled: in the Settings preview
 * the page lives in an iframe, and `document.body` there would be the
 * editor's. Focus is trapped by hand, the page behind does not scroll, and the
 * parent puts focus back on whatever opened it.
 */
export function QuickAddSheet({
  product,
  onClose,
  onAdded,
}: {
  product: Product;
  /** Closing without adding. */
  onClose: () => void;
  /** An add from the sheet: the parent closes it and confirms. */
  onAdded: (product: Product) => void;
}) {
  const t = useTranslations("storefront");
  const flow = useStorefrontFlow();
  const panelRef = useRef<HTMLDivElement>(null);
  const minutes = productMinutes(product);

  /* Focus in, scroll lock, Escape and the Tab trap. */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const doc = panel.ownerDocument;
    const root = doc.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    panel.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = doc.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    doc.addEventListener("keydown", onKey, true);
    return () => {
      doc.removeEventListener("keydown", onKey, true);
      root.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Swipe down on the handle or header to close (phones only: from md up the
     panel is a drawer and the handle is not drawn). Direct style writes keep
     a drag from re-rendering the picker on every pixel. */
  const drag = useRef<{ y: number; at: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const panel = panelRef.current;
    if (!panel || (e.target as HTMLElement).closest("a,button")) return;
    if (panel.ownerDocument.defaultView?.matchMedia("(min-width: 768px)").matches) return;
    drag.current = { y: e.clientY, at: e.timeStamp, dy: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    panel.style.transition = "none";
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    if (!d || !panel) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.style.transform = `translateY(${d.dy}px)`;
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!d || !panel) return;
    const fast = d.dy / Math.max(1, e.timeStamp - d.at) > 0.6;
    if (d.dy > 100 || (fast && d.dy > 40)) {
      onClose();
      return;
    }
    panel.style.transition = "transform 160ms ease-out";
    panel.style.transform = "";
  };

  const hooks = {
    onAdd: (line: Omit<BasketLine, "id">) => {
      flow.addLine(line);
      onAdded(product);
    },
    onBook: (line: Omit<BasketLine, "id">) => {
      flow.addLine(line);
      flow.goCheckout();
    },
  };

  const detailsCls =
    "inline-flex min-h-11 items-center gap-inline text-[14px] font-semibold text-[var(--sf-ink)] underline-offset-4 hover:underline";
  const detailsInner = (
    <>
      {t("sheet.seeDetails")}
      <ArrowRight size={16} strokeWidth={2} aria-hidden />
    </>
  );

  return (
    <div className="fixed inset-0 z-[70]" data-sf-quickadd>
      <div aria-hidden className="sf-fade absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("sheet.label", { name: product.name })}
        tabIndex={-1}
        className={cn(
          "sf-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[20px] bg-white shadow-[0_-12px_40px_rgba(0,0,0,0.18)] outline-none",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-[20px] md:shadow-[-12px_0_40px_rgba(0,0,0,0.18)]",
        )}
      >
        {/* Handle + header: the grab area on a phone. */}
        <div
          data-sf-grab
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="shrink-0 touch-none border-b border-hairline"
        >
          <div aria-hidden className="mx-auto mt-comfortable h-1.5 w-10 rounded-full bg-line md:hidden" />
          <div className="flex items-start gap-comfortable px-section pb-tight pt-comfortable md:pt-section">
            <Media
              src={product.images?.[0]?.url}
              alt=""
              bookingType={product.bookingType}
              seed={product.id}
              iconSize={14}
              className="h-16 w-16 shrink-0 rounded-[12px]"
            />
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-[18px] font-semibold leading-snug tracking-[-0.01em]">{product.name}</h2>
              <p className="mt-inline flex flex-wrap items-center gap-x-comfortable text-[14px] text-muted">
                <span>{t(`filter.${typeGroup(product.bookingType)}`)}</span>
                {minutes !== null && (
                  <span className="inline-flex items-center gap-inline">
                    <Clock size={14} strokeWidth={1.75} aria-hidden />
                    {formatDuration(minutes)}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("sheet.close")}
              className="-mr-tight -mt-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors duration-quick hover:bg-subtle"
            >
              <X size={20} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="px-section pb-inline">
            {flow.mode === "preview" ? (
              <button type="button" onClick={() => flow.goProduct(product.id)} className={detailsCls}>
                {detailsInner}
              </button>
            ) : (
              <Link href={`/s/${flow.storefront.slug}/${flow.slugs[product.id]}`} className={detailsCls}>
                {detailsInner}
              </Link>
            )}
          </div>
        </div>

        <BookingPicker product={product} sheet={hooks} />
      </div>
    </div>
  );
}
