"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { SCENES } from "./scenes";
import s from "./brand-motion.module.css";

/* The looping product story. Scenes are timed by the progress bar itself: the
   active segment's fill is a CSS animation, and its end event moves on. So the
   scene, the caption and the bar can never drift apart, and "pause" is only
   animation-play-state — no timers, no setState inside effects.

   Paused when the tab is hidden (a store on visibilitychange) and while the
   pointer rests on the stage (CSS). With reduced motion — the device setting or
   the in-app one — nothing loops: one composed scene is shown and the segments
   still switch it. */

const KEYS = ["sell", "scan", "know", "fill"] as const;

function subscribeVisible(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}
const getVisible = () => document.visibilityState === "visible";

function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}
const getReduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";

export function ProductStory() {
  const t = useTranslations("auth.shell.story");
  const visible = useSyncExternalStore(subscribeVisible, getVisible, () => true);
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, () => false);
  const [st, setSt] = useState({ cur: 0, prev: -1 });

  const go = (n: number) => setSt((x) => (n === x.cur ? x : { cur: n, prev: reduced ? -1 : x.cur }));

  return (
    <div
      className={s.story}
      data-testid="story"
      data-scene={KEYS[st.cur]}
      data-paused={!visible ? "" : undefined}
      data-static={reduced ? "" : undefined}
    >
      <div className={s.stage} aria-hidden>
        {SCENES.map((Scene, i) =>
          i === st.cur || i === st.prev ? (
            <div
              key={i}
              data-scene-id={KEYS[i]}
              className={cn(s.scene, i === st.cur ? s.in : s.out)}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && i === st.prev) setSt((x) => ({ ...x, prev: -1 }));
              }}
            >
              <Scene />
            </div>
          ) : null,
        )}
      </div>

      <div key={st.cur} className={cn(s.caption, "mt-section min-h-[4.5rem]")}>
        <p className="text-lg font-semibold tracking-title text-fg">{t(`${KEYS[st.cur]}.title`)}</p>
        <p className="mt-inline max-w-md text-base text-muted">{t(`${KEYS[st.cur]}.body`)}</p>
      </div>

      <div role="tablist" aria-label={t("label")} className="mt-section flex gap-comfortable">
        {KEYS.map((k, i) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={i === st.cur}
            data-scene-tab={k}
            onClick={() => go(i)}
            className={cn(s.tab, "text-sm font-medium transition-colors", i === st.cur ? "text-fg" : "text-muted hover:text-fg")}
          >
            <span>{t(`${k}.name`)}</span>
            <span className={s.track} aria-hidden>
              <span
                className={s.fill}
                data-s={i < st.cur ? "done" : i === st.cur ? "active" : "todo"}
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget && i === st.cur && !reduced) go((i + 1) % KEYS.length);
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
