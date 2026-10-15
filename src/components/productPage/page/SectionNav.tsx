"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "next-intl";
import type { PageSectionId } from "@/lib/api/types";
import { sectionAnchor, usePage, type PageCtx } from "./context";
import { sectionHasContent } from "./sections";
import { hasTicketOptions, usePrimaryLabel } from "./ticketRows";

const NAV_H = 56;
const MAX_ANCHORS = 5;

/** The label a section's anchor carries: the page's own word for it. */
const labelOf = (id: PageSectionId, labels: PageCtx["labels"]): string | null => {
  switch (id) {
    case "about": return labels.about;
    case "highlights": return labels.highlights;
    case "included": return labels.included;
    case "know": return labels.know;
    case "lineup": return labels.lineup;
    case "schedule": return labels.schedule;
    case "gallery": return labels.gallery;
    case "video": return labels.video;
    case "venue": return labels.venue;
    case "sponsors": return labels.sponsors;
    case "faq": return labels.faq;
    case "tickets": return labels.tickets;
    default: return null; // hero, countdown and stats are not places to jump to
  }
};

/**
 * The sticky section bar (docs/product-page.md §3.3): it appears once the hero
 * has scrolled away and gives the page's name, up to five anchors to sections
 * that actually draw something, and the primary action. On a phone it is the
 * name and the action only.
 *
 * It is out of the flow (a negative bottom margin) so it never pushes the page,
 * and `inert` while hidden so it cannot be tabbed to. In the designer's preview
 * (`ctx.inert`) the anchors still scroll the frame — that moves nothing but the
 * view — while the action does what every action does there: nothing.
 */
export function SectionNav({ sentinelRef }: { sentinelRef: RefObject<HTMLDivElement | null> }) {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const navRef = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);
  const [active, setActive] = useState<PageSectionId | null>(null);

  const anchors = ctx.sections
    .filter((id) => (id === "tickets" ? hasTicketOptions(ctx) : sectionHasContent(id, ctx)))
    .map((id) => ({ id, label: labelOf(id, ctx.labels) }))
    .filter((a): a is { id: PageSectionId; label: string } => !!a.label)
    .slice(0, MAX_ANCHORS);
  const key = anchors.map((a) => a.id).join(",");

  /* Visible once the hero's foot has gone above the top of the page. The
     observer is made in the window the page lives in, so it measures the
     designer's frame rather than the editor around it. */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const win = el.ownerDocument.defaultView;
    const IO = win?.IntersectionObserver ?? IntersectionObserver;
    const io = new IO(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelRef]);

  /* Which section is under the bar, so its anchor can say so. */
  useEffect(() => {
    const doc = navRef.current?.ownerDocument;
    if (!doc || !key) return;
    const win = doc.defaultView;
    const IO = win?.IntersectionObserver ?? IntersectionObserver;
    const ids = key.split(",") as PageSectionId[];
    const seen = new Map<string, boolean>();
    const io = new IO(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = ids.find((id) => seen.get(sectionAnchor(id)));
        if (first) setActive(first);
      },
      { rootMargin: `-${NAV_H + 16}px 0px -55% 0px`, threshold: 0 },
    );
    for (const id of ids) {
      const node = doc.getElementById(sectionAnchor(id));
      if (node) io.observe(node);
    }
    return () => io.disconnect();
  }, [key]);

  const go = (id: PageSectionId) => {
    const node = navRef.current?.ownerDocument.getElementById(sectionAnchor(id));
    const win = navRef.current?.ownerDocument.defaultView;
    if (!node || !win) return;
    const calm = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
  };

  const label = usePrimaryLabel(ctx);
  const phone = ctx.layout === "phone";

  return (
    <div
      ref={navRef}
      inert={!past}
      className="sticky top-0 z-30 motion-reduce:transition-none"
      style={{
        height: NAV_H,
        marginBottom: -NAV_H,
        background: "var(--pg-card)",
        borderBottom: "1px solid var(--pg-line)",
        boxShadow: "0 6px 20px rgb(0 0 0 / 0.08)",
        opacity: past ? 1 : 0,
        transform: past ? "none" : "translateY(-100%)",
        transition: "opacity 160ms ease, transform 200ms ease",
        pointerEvents: past ? "auto" : "none",
      }}
    >
      <nav aria-label={t("pg.shell.navLabel")} className="pg-container flex h-full items-center gap-4">
        <span className="min-w-0 max-w-[40%] shrink-0 truncate text-[16px] font-semibold md:max-w-[28%]" style={{ color: "var(--pg-fg)" }}>
          {ctx.ev.title}
        </span>
        {!phone && anchors.length > 0 && (
          <ul className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {anchors.map((a) => {
              const on = active === a.id;
              return (
                <li key={a.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => go(a.id)}
                    aria-current={on ? "location" : undefined}
                    className="relative inline-flex min-h-11 items-center rounded-[10px] px-3 text-[14px] font-medium transition-colors"
                    style={{ color: on ? "var(--pg-ink)" : "var(--pg-muted)" }}
                  >
                    {a.label}
                    {on && <span aria-hidden className="absolute inset-x-3 bottom-1 h-0.5 rounded-full" style={{ background: "var(--pg-accent)" }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          className="pg-btn ml-auto shrink-0"
          style={{ minHeight: 44, padding: "0 16px" }}
          onClick={() => ctx.book()}
        >
          {label}
        </button>
      </nav>
    </div>
  );
}
