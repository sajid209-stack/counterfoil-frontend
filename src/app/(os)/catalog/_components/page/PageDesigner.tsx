"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Eye, Monitor, Smartphone } from "lucide-react";
import { Button, SegmentedControl, Sheet } from "@/components/ui";
import { PreviewFrame } from "@/components/PreviewFrame";
import { ProductPageView } from "@/components/productPage/ProductPageView";
import { cn } from "@/lib/cn";
import type { PageLook, Product, ProductPage } from "@/lib/api/types";
import { CountdownSettings } from "./CountdownSettings";
import { LookControls } from "./LookControls";
import { SectionList } from "./SectionList";
import { switchLook } from "./pageOps";

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
export function PageDesigner({ product, page, onPage, onEditDetails, onEditTickets, onDescription, className }: PageDesignerProps) {
  const t = useTranslations("catalog.page");
  const tc = useTranslations("common");
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<Device | null>(null);
  const [sheet, setSheet] = useState(false);

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
  const setLook = (look: PageLook) => onPage(switchLook(page, look));

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
    <div className="card-surface flex flex-col gap-major p-card">
      <LookControls product={product} page={page} onLook={setLook} onPage={patch} />
      <CountdownSettings product={product} page={page} onPage={onPage} />
      <SectionList product={product} page={page} onPage={onPage} onDescription={onDescription} onEditDetails={onEditDetails} onEditTickets={onEditTickets} />
    </div>
  );

  return (
    <div ref={root} className={cn("min-w-0", className)}>
      {side ? (
        <div className="grid grid-cols-[22.5rem_minmax(0,1fr)] items-start gap-section">
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
