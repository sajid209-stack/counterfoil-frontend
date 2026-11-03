"use client";

import type { EventDay } from "@/lib/api";
import { useId, useMemo, useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Eye, Monitor, Smartphone } from "lucide-react";
import { Button, SegmentedControl, Sheet, Tabs, tabPanelProps } from "@/components/ui";
import { PreviewFrame } from "@/components/PreviewFrame";
import { ProductPageView } from "@/components/productPage/ProductPageView";
import { cn } from "@/lib/cn";
import { getStorefrontFor } from "@/lib/api/storefront";
import type { PageStyle, Product, ProductPage } from "@/lib/api/types";
import { DesignPanel } from "@/components/pageStyle/DesignPanel";
import { lookOf } from "@/components/productPage/page/theme";
import { productPageStyle } from "@/lib/pageStyle/resolve";
import { ACCENT_HEX } from "@/lib/storefront/theme";
import { SectionList } from "./SectionList";

export interface PageDesignerProps {
  /** The draft. Only used to draw the preview and to read what the page is made from. */
  product: Product;
  /** The page being designed (`pageOf(product)` until the operator changes it). */
  page: ProductPage;
  onPage: (next: ProductPage) => void;
  /** Where the item's facts are edited — the wizard's Details step, the record's Details tab. */
  onEditDetails?: () => void;
  /** Where the tickets are edited — "Tickets & prices". */
  onEditTickets?: () => void;
  /** When given, the About section edits the item's description right here. */
  onDescription?: (next: string) => void;
  /** When given, the Programme edits each day's name and hours right here. */
  onDays?: (days: EventDay[]) => void;
  className?: string;
}

type Device = "phone" | "desktop";
/** The width the page LAYS OUT at, scaled to fit the column. */
const DEVICE: Record<Device, { width: number; height: number }> = {
  phone: { width: 390, height: 780 },
  desktop: { width: 1280, height: 860 },
};

/** Where the controls and the preview share a row, and where the preview is wide enough for a desktop. */
const SIDE_AT = 760;
const WIDE_AT = 1100;

/**
 * The item's page, designed beside the real page (docs/catalog.md §9.3).
 *
 * Controls on the left (a 360px column) and the page itself on the right — the
 * real `ProductPageView`, in a frame at a real device width. It lays out from
 * its OWN width, not the screen's: in a wizard column or a record tab it can be
 * narrow even on a wide screen, and then the preview is one press away in a
 * sheet instead of beside the controls.
 *
 * It never publishes. "Use this page" is the parent's primary action (the
 * wizard step, the record tab's save bar).
 */
export function PageDesigner({ product, page, onPage, onEditDetails, onEditTickets, onDescription, onDays, className }: PageDesignerProps) {
  const t = useTranslations("catalog.page");
  const tc = useTranslations("common");
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<Device | null>(null);
  const [sheet, setSheet] = useState(false);
  const [tab, setTab] = useState<"design" | "sections">("design");
  const tabsId = useId();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const side = width >= SIDE_AT;
  const device: Device = picked ?? (width >= WIDE_AT ? "desktop" : "phone");
  const shown = useMemo<Product>(() => ({ ...product, page }), [product, page]);

  const patch = (p: Partial<ProductPage>) => onPage({ ...page, ...p });

  const [brand, setBrand] = useState<{ style: PageStyle; accent: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    const loc = product.locationIds[0];
    if (!loc) return;
    void getStorefrontFor(loc).then((res) => {
      if (alive && res.ok) setBrand({ style: res.data.style ?? {}, accent: res.data.accent ? ACCENT_HEX[res.data.accent] : null });
    });
    return () => { alive = false; };
  }, [product.locationIds]);

  const brandHasStyle = !!brand && Object.keys(brand.style).length > 0;
  const custom = (page.styleSource ?? "brand") === "custom";
  /* What a change is written onto: the page's own style, or — the first time
     it is touched — the venue's, so going custom starts from what it already
     looked like. */
  const base: PageStyle = custom ? (page.style ?? brand?.style ?? {}) : (brand?.style ?? {});
  /* What the page draws right now, so the panel shows the current choice even
     when the page has no style of its own (an old page's look). */
  const resolved = useMemo(
    () => productPageStyle({ look: lookOf(page.look), page, brand: brand?.style, venueAccent: brand?.accent }),
    [page, brand],
  );

  const switcher = (
    <SegmentedControl
      size="sm"
      className="shrink-0"
      aria-label={t("device")}
      value={device}
      onChange={(d) => setPicked(d as Device)}
      options={(["phone", "desktop"] as const).map((d) => {
        const Icon = d === "phone" ? Smartphone : Monitor;
        return { value: d, icon: <Icon size={14} strokeWidth={1.5} aria-hidden />, label: t(d === "phone" ? "devicePhone" : "deviceDesktop") };
      })}
    />
  );

  const frame = (d: Device) => (
    <PreviewFrame width={DEVICE[d].width} height={DEVICE[d].height} title={t("previewFrame", { name: product.name || t("untitled") })}>
      <ProductPageView product={shown} mode="preview" chrome="none" />
    </PreviewFrame>
  );

  const controls = (
    <div className="card-surface flex min-w-0 flex-col gap-comfortable p-card">
      <Tabs
        id={tabsId}
        aria-label={t("design.tabs")}
        value={tab}
        onChange={(v) => setTab(v as "design" | "sections")}
        items={[
          { value: "design", label: t("design.tabDesign") },
          { value: "sections", label: t("design.tabSections") },
        ]}
      />
      <div {...tabPanelProps(tabsId, tab)} className="min-w-0">
        {tab === "design" ? (
          <DesignPanel
            scope="page"
            value={base}
            resolved={resolved}
            onChange={(next) => patch({ styleSource: "custom", style: next })}
            coverUrl={page.coverUrl}
            fallbackCover={product.images[0]?.url}
            onCoverUrl={(coverUrl) => patch({ coverUrl })}
            onResetToBrand={custom && brandHasStyle ? () => patch({ styleSource: "brand" }) : undefined}
          />
        ) : (
          <SectionList product={product} page={page} onPage={onPage} onDescription={onDescription} onDays={onDays} onEditDetails={onEditDetails} onEditTickets={onEditTickets} />
        )}
      </div>
    </div>
  );

  return (
    <div ref={root} className={cn("min-w-0", className)}>
      {side ? (
        <div className="grid grid-cols-[minmax(0,22.5rem)_minmax(0,1fr)] items-start gap-section">
          {controls}
          <aside aria-label={t("preview")} className="card-surface sticky top-comfortable flex min-w-0 flex-col gap-comfortable p-card">
            <div className="flex flex-wrap items-center justify-between gap-tight">
              <h3 className="text-md font-semibold text-fg">{t("preview")}</h3>
              {switcher}
            </div>
            <div className="rounded-sm bg-muted-wash p-tight">
              <div className="mx-auto overflow-hidden rounded-xs" style={device === "phone" ? { maxWidth: DEVICE.phone.width } : undefined}>
                {frame(device)}
              </div>
            </div>
            <p className="text-sm text-muted">{t("previewNote")}</p>
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-section">
          <Button variant="secondary" icon={<Eye size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setSheet(true)} fullWidth>
            {t("openPreview")}
          </Button>
          {controls}
          <Sheet open={sheet} onClose={() => setSheet(false)} title={t("preview")} closeLabel={tc("close")} lead={undefined}>
            <div className="flex flex-col gap-comfortable p-card">
              {width >= 640 && switcher}
              {sheet && (
                <div className="mx-auto w-full overflow-hidden rounded-xs" style={device === "phone" ? { maxWidth: DEVICE.phone.width } : undefined}>
                  {frame(width >= 640 ? device : "phone")}
                </div>
              )}
            </div>
          </Sheet>
        </div>
      )}
    </div>
  );
}
