"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LOGO_LETTERS, LOGO_MARK } from "@/components/brand/logoArt";
import m from "./signout.module.css";

/**
 * The goodbye, played over the sign-in page on /signed-out. A ticket tears,
 * and what stays in your hand is the counterfoil, which is the Counterfoil
 * mark. The mark centres with a light landing, the wordmark follows it out,
 * and then the logo flies into its place on the sign-in card as the card rises
 * up under it like a drawer. One continuous object from the first frame to the
 * form: nothing cuts, nothing reloads.
 *
 *     0 –  700  the ticket rises in and settles
 *   420 – 1200  the perforation punches through, top to bottom
 *  1000 – 1250  tension: the body starts to peel from the top of the tear
 *  1250 – 1950  the body tears free and drifts off; the stub recoils a little
 *  1500 – 2200  the counterfoil glides to the centre
 *  2000 – 2650  it lands: 96% → 102.5% → 100%
 *  2600 – 3200  the mark steps left to make room
 *  3000 – 4020  the letters follow it out, one by one
 *  4200 – 5300  the logo flies to the card's logo; the card rises; the page fades in
 *
 * The page underneath is server-rendered and hidden by one rule in globals.css
 * (`html:has([data-signout-intro])`), so there is no flash of the form before
 * the overlay. Any key or tap skips straight to the hand-over. Reduced motion:
 * the finished logo, still, then a short cross-fade.
 *
 * Only transform, opacity and (on the brand panel) clip-path animate, on the
 * Web Animations API so each segment has its own easing: one long CSS keyframe
 * list with one easing stops and starts at every keyframe, which is the hitch
 * the first version had.
 */

const INTRO = 4100;
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)"; // expo out: arrivals
const GLIDE = "cubic-bezier(0.45, 0, 0.2, 1)"; // a move that starts and lands softly
const IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const FLIGHT = "cubic-bezier(0.7, 0, 0.2, 1)";
const WIPE = "cubic-bezier(0.76, 0, 0.24, 1)";

// The ticket body: a ticket's length, the same corner radius as the mark, and
// a left edge cut to the mark's own zigzag (set 1.5 units into the ink so no
// hairline shows before the tear). Torn away, it carries the matching teeth,
// as real paper does.
const BODY =
  "M62.4 0 H222 a14 14 0 0 1 14 14 V56 a14 14 0 0 1 -14 14 H63.6 L64.5 66.5 L52.3 60.2 L50.8 58.3 L52.3 56.5 L67.4 48.5 L68.9 46.7 L67.4 44.8 L52.2 36.9 L50.7 35 L52.2 33.1 L67.4 25.2 L68.9 23.3 L67.4 21.5 L52.2 13.5 L50.7 11.7 L52.2 9.8 L63.4 3.9 Z";

// The mark's own zigzag edge, just inside the ink. The perforation is punched
// along it, so the line you tear along is the edge the logo keeps.
const EDGE: [number, number][] = [[65.5, 2.5], [53, 11.7], [69.4, 23.3], [53, 35], [69.4, 46.7], [53, 58.3], [66.5, 67.5]];
const HOLES = (() => {
  const pts: [number, number][] = [];
  const STEP = 5.4;
  let carry = 0;
  for (let i = 0; i < EDGE.length - 1; i++) {
    const [x1, y1] = EDGE[i];
    const [x2, y2] = EDGE[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    let d = carry;
    for (; d <= len; d += STEP) pts.push([Math.round((x1 + ((x2 - x1) * d) / len) * 10) / 10, Math.round((y1 + ((y2 - y1) * d) / len) * 10) / 10]);
    carry = d - len;
  }
  return pts;
})();

type Step = [at: number, props: Keyframe, ease?: string];

// One element, one timeline, an easing per segment.
function play(el: Element | null | undefined, steps: Step[], total: number, into: Animation[]) {
  if (!el) return;
  const s = [...steps];
  if (s[0][0] > 0) s.unshift([0, s[0][1]]);
  if (s[s.length - 1][0] < total) s.push([total, s[s.length - 1][1]]);
  const frames = s.map(([at, props, ease]) => ({ ...props, offset: at / total, easing: ease ?? "linear" }));
  into.push(el.animate(frames, { duration: total, fill: "both" }));
}

function once(el: Element | null | undefined, from: Keyframe, to: Keyframe, duration: number, delay: number, easing: string, into: Animation[]) {
  if (!el) return;
  into.push(el.animate([from, to], { duration, delay, easing, fill: "both" }));
}

export function SignOutIntro() {
  const pathname = usePathname();
  const t = useTranslations("auth.signedOut");
  const root = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const active = pathname === "/signed-out" && !gone;

  useEffect(() => {
    const el = root.current;
    if (!active || !el) return;
    const q = (s: string) => el.querySelector(s);
    const intro: Animation[] = [];
    const page: Animation[] = [];
    let timer = 0;
    let revealing = false;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      el.dataset.phase = "done";
      page.forEach((a) => a.cancel());
      setGone(true);
      if (window.location.pathname === "/signed-out") window.history.replaceState(null, "", "/sign-in");
    };
    const settle = () => Promise.all(page.map((a) => a.finished)).then(finish, () => {});

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduce";
    const reveals = () => [...document.querySelectorAll("[data-auth-reveal], [data-auth-logo]")];

    if (reduce) {
      timer = window.setTimeout(() => {
        once(el, { opacity: 1 }, { opacity: 0 }, 280, 0, "ease-out", page);
        reveals().forEach((r) => once(r, { opacity: 0 }, { opacity: 1 }, 280, 0, "ease-out", page));
        settle();
      }, 700);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
        page.forEach((a) => a.cancel());
      };
    }

    // ---- The ticket ------------------------------------------------------
    play(q("[data-part=enter]"), [[0, { opacity: 0, transform: "translateY(18px) scale(0.94)" }, OUT], [700, { opacity: 1, transform: "translateY(0px) scale(1)" }]], INTRO, intro);
    play(q("[data-part=track]"), [
      [0, { transform: "translateX(130px)" }],
      [1500, { transform: "translateX(130px)" }, GLIDE],
      [2200, { transform: "translateX(213px)" }],
      [2600, { transform: "translateX(213px)" }, IN_OUT],
      [3200, { transform: "translateX(0px)" }],
    ], INTRO, intro);
    el.querySelectorAll("[data-part=hole]").forEach((h, i) => {
      const at = 420 + i * 24;
      play(h, [
        [0, { opacity: 0, transform: "scale(0)" }],
        [at, { opacity: 0, transform: "scale(0)" }, OUT],
        [at + 280, { opacity: 1, transform: "scale(1)" }],
        [1250, { opacity: 1, transform: "scale(1)" }, "ease-in"],
        [1420, { opacity: 0, transform: "scale(1)" }],
      ], INTRO, intro);
    });
    play(q("[data-part=cut]"), [[0, { opacity: 1 }], [1250, { opacity: 1 }, "ease-in"], [1420, { opacity: 0 }]], INTRO, intro);

    // ---- The tear --------------------------------------------------------
    // It opens from the top of the tear line first (rotating about the bottom
    // corner), then lets go and drifts off as it fades.
    play(q("[data-part=body]"), [
      [0, { transform: "translate(0px, 0px) rotate(0deg)" }],
      [1000, { transform: "translate(0px, 0px) rotate(0deg)" }, "cubic-bezier(0.45, 0, 0.55, 1)"],
      [1250, { transform: "translate(1px, 0px) rotate(2.4deg)" }, "cubic-bezier(0.3, 0, 0.1, 1)"],
      [1950, { transform: "translate(118px, 16px) rotate(10deg)" }],
    ], INTRO, intro);
    play(q("[data-part=bodyFade]"), [[0, { opacity: 1 }], [1380, { opacity: 1 }, "cubic-bezier(0.4, 0, 1, 1)"], [1880, { opacity: 0 }]], INTRO, intro);
    // The stub is left in your hand with a small recoil.
    play(q("[data-part=recoil]"), [
      [0, { transform: "translateX(0px)" }],
      [1250, { transform: "translateX(0px)" }, OUT],
      [1400, { transform: "translateX(-4px)" }, IN_OUT],
      [1780, { transform: "translateX(0px)" }],
    ], INTRO, intro);

    // ---- The landing and the wordmark -------------------------------------
    play(q("[data-part=pop]"), [
      [0, { transform: "scale(1)" }],
      [2000, { transform: "scale(1)" }, IN_OUT],
      [2200, { transform: "scale(0.96)" }, OUT],
      [2420, { transform: "scale(1.025)" }, IN_OUT],
      [2650, { transform: "scale(1)" }],
    ], INTRO, intro);
    el.querySelectorAll("[data-part=letter]").forEach((l, i) => {
      // Each letter starts once the mark has cleared the space it lands in.
      const at = 3000 + i * 32;
      play(l, [
        [0, { opacity: 0, transform: "translateX(26px)" }],
        [at, { opacity: 0, transform: "translateX(26px)" }, OUT],
        [at + 700, { opacity: 1, transform: "translateX(0px)" }],
      ], INTRO, intro);
    });

    // ---- The hand-over -----------------------------------------------------
    // The logo flies to the sign-in card's own logo (the same drawing, so the
    // swap at the end is invisible) while the card rises under it.
    const reveal = () => {
      if (revealing) return;
      revealing = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", reveal);
      window.removeEventListener("pointerdown", reveal);
      intro.forEach((a) => a.finish());

      const flight = q("[data-part=flight]");
      const svg = q("svg");
      const target = document.querySelector("[data-auth-logo] svg");
      // How far the card rises: exactly as far as the logo travels up, on the
      // same curve, so the logo's slot stays under the flying logo all the way
      // and the two meet without the logo ever crossing the form.
      let rise = 56;
      if (flight && svg && target) {
        const fr = flight.getBoundingClientRect();
        const sr = svg.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const s = tr.width / sr.width;
        const tx = tr.left - fr.left - s * (sr.left - fr.left);
        const ty = tr.top - fr.top - s * (sr.top - fr.top);
        rise = Math.max(56, sr.top + sr.height / 2 - (tr.top + tr.height / 2));
        once(flight, { transform: "translate(0px, 0px) scale(1)" }, { transform: `translate(${tx}px, ${ty}px) scale(${s})` }, 950, 0, FLIGHT, page);
      } else {
        once(flight, { opacity: 1 }, { opacity: 0 }, 400, 0, "ease-out", page);
      }
      once(q("[data-part=scrim]"), { opacity: 1 }, { opacity: 0 }, 560, 120, IN_OUT, page);

      const card = document.querySelector("[data-auth-reveal=card]");
      once(card, { transform: `translateY(${rise}px)` }, { transform: "translateY(0px)" }, 950, 0, FLIGHT, page);
      once(card, { opacity: 0 }, { opacity: 1 }, 450, 120, "ease-out", page);
      card?.querySelectorAll("form > *").forEach((c, i) => {
        once(c, { opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0px)" }, 700, 320 + i * 60, OUT, page);
      });
      once(document.querySelector("[data-auth-reveal=panel]"), { opacity: 1, clipPath: "inset(100% 0 0 0)" }, { opacity: 1, clipPath: "inset(0% 0 0 0)" }, 1100, 0, WIPE, page);
      document.querySelectorAll("[data-auth-reveal=chrome]").forEach((c) => once(c, { opacity: 0 }, { opacity: 1 }, 600, 450, "ease-out", page));
      settle();
    };

    timer = window.setTimeout(reveal, INTRO + 100);
    window.addEventListener("keydown", reveal);
    window.addEventListener("pointerdown", reveal);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", reveal);
      window.removeEventListener("pointerdown", reveal);
      intro.forEach((a) => a.cancel());
      page.forEach((a) => a.cancel());
    };
  }, [active]);

  if (!active) return null;

  return (
    <div ref={root} className={m.root} data-signout-intro>
      <div className={m.scrim} data-part="scrim" />
      <p className="sr-only" role="status">{t("status")}</p>
      <div className={m.flight} data-part="flight">
        <svg viewBox="0 0 496 70" className={m.stage} aria-hidden fill="currentColor" overflow="visible">
          <g className={m.track} data-part="track">
            <g className={m.enter} data-part="enter">
              <g data-part="bodyFade">
                <g className={m.body} data-part="body"><path d={BODY} /></g>
              </g>
              <g data-part="recoil">
                <g className={m.pop} data-part="pop"><path d={LOGO_MARK} /></g>
              </g>
              {/* The two notches a ticket has at its tear line. */}
              <g className={m.cut} data-part="cut">
                <circle cx="61" cy="0" r="5" />
                <circle cx="61" cy="70" r="5" />
              </g>
              {HOLES.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" className={m.hole} data-part="hole" />)}
            </g>
          </g>
          {LOGO_LETTERS.map((d) => <path key={d.slice(0, 16)} d={d} className={m.letter} data-part="letter" />)}
        </svg>
      </div>
    </div>
  );
}
