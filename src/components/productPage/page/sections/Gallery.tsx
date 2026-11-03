"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { ProductImage } from "@/lib/api/types";
import { bentoPlan, cellStyle, gridStyle } from "../bento";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, galleryOf } from "./helpers";

const MOSAIC = 6;

/**
 * Photos: the booking's own pictures, arranged by how many there are
 * (`bentoPlan`, up to six: one fills the row, two share it, three put a lead
 * beside two, and so on) so no count leaves a hole. Past six, the rest sit
 * behind "Show all". Real photos only; with none there is no section.
 */
export function GallerySection() {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const [all, setAll] = useState(false);
  const photos = galleryOf(ctx);
  if (photos.length === 0) return null;

  const { layout } = ctx;
  const total = photos.length;
  const alt = (p: ProductImage, i: number) => clean(p.alt) || t("page.photoOf", { n: i + 1, total });

  const tile = (p: ProductImage, i: number, style?: CSSProperties, ratio?: string) => (
    <div
      key={p.id}
      className="pg-media relative overflow-hidden"
      style={{ background: "var(--pg-surface)", border: "1px solid var(--pg-line)", aspectRatio: ratio, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local / remote photos; next/image loader config is avoided app-wide (see PROJECT_LOG) */}
      <img src={p.url} alt={alt(p, i)} width={800} height={600} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
    </div>
  );

  let body: React.ReactNode;
  if (all) {
    const cols = layout === "phone" ? 2 : 3;
    body = (
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: "var(--pg-gap, 16px)" }}>
        {photos.map((p, i) => tile(p, i, undefined, "4 / 3"))}
      </div>
    );
  } else {
    const shown = photos.slice(0, MOSAIC);
    const plan = bentoPlan(shown.length, layout);
    /* One photo keeps its own shape; the rest sit on rows of a set height, a
       lead that spans two rows holding both. */
    const row = layout === "phone" ? 168 : layout === "tablet" ? 200 : 232;
    body =
      shown.length === 1 ? (
        tile(shown[0], 0, undefined, layout === "phone" ? "16 / 10" : "21 / 9")
      ) : (
        <div style={{ ...gridStyle(plan), gap: "var(--pg-gap, 16px)", gridAutoRows: row }}>
          {shown.map((p, i) => tile(p, i, cellStyle(plan.cells[i])))}
        </div>
      );
  }

  return (
    <Section id="gallery" title={ctx.labels.gallery}>
      {body}
      {total > MOSAIC && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="pg-btn-secondary mt-5">
          {all ? t("pg.sec.showFewer") : t("pg.sec.showAllPhotos", { count: total })}
        </button>
      )}
    </Section>
  );
}
