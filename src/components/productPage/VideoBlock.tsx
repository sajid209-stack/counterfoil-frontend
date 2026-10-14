"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { parseEventVideo } from "@/lib/events/video";

/**
 * A video that costs nothing until it is played.
 *
 * The page shows the poster and a play button; the player (and with it a
 * request to YouTube or Vimeo, and their cookies) loads only when the visitor
 * presses it, exactly as the event template does. A link that does not parse
 * draws nothing — a broken player is worse than none.
 */
export function VideoBlock({ url, title }: { url: string; title: string }) {
  const t = useTranslations("storefront");
  const [playing, setPlaying] = useState(false);
  const video = parseEventVideo(url);
  if (!video) return null;
  /* Best poster first; the template stacks them because the largest does not
     exist for a video never uploaded above 720p. */
  const poster = video.posters.map((u) => `url(${u}) center/cover`).join(", ");
  return (
    <div
      className="relative aspect-video overflow-hidden rounded-lg border border-hairline bg-subtle"
      style={poster ? { background: poster } : undefined}
    >
      {playing ? (
        <iframe
          src={video.embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={t("page.playVideo")}
          className="absolute inset-0 grid w-full place-items-center bg-gradient-to-b from-black/10 to-black/40"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-fg shadow-float">
            <Play size={26} strokeWidth={1.75} className="ml-1" aria-hidden />
          </span>
        </button>
      )}
    </div>
  );
}
