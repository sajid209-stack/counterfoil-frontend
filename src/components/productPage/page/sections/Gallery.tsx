"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import type { ProductImage } from "@/lib/api/types";
import { usePage } from "../context";
import { Section } from "../Section";
import { clean, galleryOf } from "./helpers";

const MOSAIC = 5;

/**
 * Photos: the booking's own pictures as a mosaic — one large and up to four
 * small, radius 12. Real photos only; with none there is no section, never a
 * row of generated tiles.
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
      className="relative overflow-hidden rounded-xl"
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
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {photos.map((p, i) => tile(p, i, undefined, "4 / 3"))}
      </div>
    );
  } else {
    const shown = photos.slice(0, MOSAIC);
    const n = shown.length;
    if (n === 1) {
      body = tile(shown[0], 0, undefined, layout === "phone" ? "16 / 10" : "21 / 9");
    } else if (layout === "phone") {
      /* One large, then the rest two across; an odd one out spans the row. */
      const rest = shown.slice(1);
      body = (
        <div className="grid grid-cols-2 gap-3">
          {tile(shown[0], 0, { gridColumn: "1 / -1" }, "16 / 10")}
          {rest.map((p, k) => tile(p, k + 1, rest.length % 2 === 1 && k === rest.length - 1 ? { gridColumn: "1 / -1" } : undefined, rest.length % 2 === 1 && k === rest.length - 1 ? "16 / 9" : "4 / 3"))}
        </div>
      );
    } else if (n === 2) {
      body = (
        <div className="grid grid-cols-2 gap-3">{shown.map((p, i) => tile(p, i, undefined, "4 / 3"))}</div>
      );
    } else {
      /* One large tile two rows tall; the smalls fill the rest exactly. */
      const height = layout === "tablet" ? 340 : 420;
      const cols = n === 3 ? "2fr 1fr" : "2fr 1fr 1fr";
      const smalls = shown.slice(1);
      body = (
        <div className="grid gap-3" style={{ gridTemplateColumns: cols, gridTemplateRows: "repeat(2, minmax(0, 1fr))", height }}>
          {tile(shown[0], 0, { gridRow: "1 / span 2" })}
          {smalls.map((p, k) =>
            tile(p, k + 1, n === 4 && k === 2 ? { gridColumn: "2 / span 2" } : undefined),
          )}
        </div>
      );
    }
  }

  return (
    <Section id="gallery" title={ctx.labels.gallery}>
      {body}
      {total > MOSAIC && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="pg-btn-secondary mt-4">
          {all ? t("pg.sec.showFewer") : t("pg.sec.showAllPhotos", { count: total })}
        </button>
      )}
    </Section>
  );
}
