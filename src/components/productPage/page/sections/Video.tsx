"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { usePage } from "../context";
import { Section } from "../Section";
import { videoOf } from "./helpers";

/**
 * Video: 16:9, radius 16, and it costs nothing until it is played. The page
 * shows the poster and a play button; the player — and with it a request to
 * YouTube, and its cookies — loads only when the visitor presses it, on the
 * privacy-preserving host (`parseEventVideo`). A link that does not parse draws
 * nothing: a broken player is worse than none.
 */
export function VideoSection() {
  const ctx = usePage();
  const t = useTranslations("storefront");
  const [playing, setPlaying] = useState(false);
  const video = videoOf(ctx);
  if (!video) return null;

  /* Best poster first; they are stacked because the largest does not exist for
     a video never uploaded above 720p. Vimeo supplies none: the plate is used. */
  const poster = video.posters.map((u) => `url(${u}) center/cover no-repeat`).join(", ");

  return (
    <Section id="video" title={ctx.labels.video}>
      <div
        className="relative aspect-video overflow-hidden"
        style={{
          borderRadius: 16,
          background: poster || "var(--pg-surface)",
          backgroundColor: "var(--pg-surface)",
          border: "1px solid var(--pg-line)",
        }}
      >
        {playing ? (
          <iframe
            src={video.embedUrl}
            title={`${ctx.labels.video}: ${ctx.ev.title}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            disabled={ctx.inert}
            onClick={() => setPlaying(true)}
            aria-label={t("page.playVideo")}
            className="absolute inset-0 grid size-full place-items-center"
            style={{ background: "linear-gradient(to bottom, rgb(0 0 0 / 0.08), rgb(0 0 0 / 0.36))" }}
          >
            <span className="grid size-16 place-items-center rounded-full" style={{ background: "var(--pg-fill)", color: "var(--pg-on-fill)" }}>
              <Play size={26} strokeWidth={1.75} className="ml-1" aria-hidden />
            </span>
          </button>
        )}
      </div>
    </Section>
  );
}
