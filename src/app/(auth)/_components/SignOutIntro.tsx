"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LOGO_LETTERS, LOGO_MARK } from "@/components/brand/logoArt";
import m from "./signout.module.css";

/**
 * The sign-in intro, played over the sign-in page on every visit to /sign-in
 * and after signing out (/signed-out). A ticket tears
 * along the Counterfoil mark's own notches, and what stays in your hand is the
 * mark, already at the centre. The full logo forms
 * around it, and then the logo flies into its place on the sign-in card as the
 * card rises up under it like a drawer.
 *
 *     0 –  600  the ticket rises in, its stub (the mark) already at the centre
 *   300 –  800  the perforation punches through along the notches, top to bottom
 *   800 – 1000  tension: the tear opens from the top
 *  1000 – 1600  the body tears free and drifts off; the mark stays still
 *  1400 – 2680  the full logo forms: the mark eases left into the lockup while
 *               the wordmark drifts out of its edge, its letters fading in one
 *               after another as one slow wave
 *  2700 – 3100  the logo rests for a beat, so it reads
 *  3100 – 4200  hand-over: the logo flies to the card's logo as the card
 *               rises under it; the page comes in around it
 *
 * The page underneath is server-rendered and hidden by one rule in globals.css
 * (`html:has([data-signout-intro])`), so there is no flash of the form before
 * the overlay. Any key or tap skips straight to the hand-over. Reduced motion:
 * the finished logo, still, then a short cross-fade.
 *
 * Only transform, opacity and (on the brand panel) clip-path animate, on the
 * Web Animations API so each segment has its own easing and the steps overlap
 * instead of queueing.
 */

const INTRO = 2700;
const HAND_AT = 3100;
const HAND = 1100;
const OUT = "cubic-bezier(0.16, 1, 0.3, 1)"; // expo out: arrivals
const IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";
const FLOW = "cubic-bezier(0.5, 0, 0.15, 1)"; // starts and lands softly
const WIPE = "cubic-bezier(0.76, 0, 0.24, 1)";
const SETTLE = "cubic-bezier(0.4, 0, 0.2, 1)"; // an even, unhurried move
const DRIFT = "cubic-bezier(0.22, 1, 0.36, 1)"; // a long, gentle arrival
const SOFT = "cubic-bezier(0.25, 0.1, 0.25, 1)"; // a fade with no snap at either end

// The mark's right edge, copied from its path in logoArt (the exact notches):
// from the top corner (63.8989, 0) down to the bottom corner (65.114, 70).
const EDGE =
  "C66.1096 0 66.841 2.9195 64.89 3.94553L53.725 9.81694C52.2252 10.6057 52.2252 12.7277 53.725 13.5164L68.8751 21.4836C70.375 22.2723 70.375 24.3943 68.8751 25.1831L53.725 33.1501C52.2252 33.9388 52.2252 36.0612 53.725 36.8499L68.8751 44.8168C70.375 45.6055 70.375 47.7278 68.8751 48.5166L53.7795 56.4548C52.2691 57.2495 52.2768 59.3903 53.7955 60.17C57.0733 61.8522 62.0063 64.3955 66.0229 66.514C67.8957 67.5022 67.2376 70 65.114 70";

// The ticket body is the exact complement of the mark: its left edge IS the
// mark's notched edge, so the torn piece carries the matching notches and the
// stub that stays is the logo, curve for curve. Same corner radius as the mark.
const BODY = `M63.8989 0${EDGE}H222a14 14 0 0 0 14 -14V14a14 14 0 0 0 -14 -14Z`;

// Two shapes sharing one edge show a hairline where their anti-aliasing meets.
// Until the tear, this strip sits under both and closes it; it goes the
// instant the tear starts.
const SEAM = "M50 0H76V70H50Z";

// The perforation: holes punched along the notched edge (its line segments'
// ends, which sit on the edge), spaced evenly.
const EDGE_PTS: [number, number][] = [
  [64.9, 3.9], [53.7, 9.8], [52.6, 11.7], [53.7, 13.5], [68.9, 21.5], [70, 23.3], [68.9, 25.2], [53.7, 33.2], [52.6, 35],
  [53.7, 36.8], [68.9, 44.8], [70, 46.7], [68.9, 48.5], [53.8, 56.5], [52.6, 58.3], [53.8, 60.2], [66, 66.5],
];
const HOLES = (() => {
  const pts: [number, number][] = [];
  const STEP = 4.6;
  let carry = 0;
  for (let i = 0; i < EDGE_PTS.length - 1; i++) {
    const [x1, y1] = EDGE_PTS[i];
    const [x2, y2] = EDGE_PTS[i + 1];
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
  // It plays on every visit to sign-in (first load, refresh, or arriving from
  // another auth page) and after signing out. /signed-out and /sign-in count as
  // one visit, because the intro itself moves the address from one to the other.
  const visit = pathname === "/signed-out" ? "/sign-in" : pathname;
  const [gone, setGone] = useState(false);
  const [seen, setSeen] = useState(visit);
  if (visit !== seen) {
    setSeen(visit);
    setGone(false);
  }
  const signedOut = pathname === "/signed-out";
  const active = visit === "/sign-in" && !gone;

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
    play(q("[data-part=enter]"), [[0, { opacity: 0, transform: "translateY(18px) scale(0.94)" }, OUT], [600, { opacity: 1, transform: "translateY(0px) scale(1)" }]], INTRO, intro);
    el.querySelectorAll("[data-part=hole]").forEach((h, i) => {
      const at = 300 + i * 14;
      play(h, [
        [0, { opacity: 0, transform: "scale(0)" }],
        [at, { opacity: 0, transform: "scale(0)" }, OUT],
        [at + 240, { opacity: 1, transform: "scale(1)" }],
        [1000, { opacity: 1, transform: "scale(1)" }, "ease-in"],
        [1150, { opacity: 0, transform: "scale(1)" }],
      ], INTRO, intro);
    });
    play(q("[data-part=seam]"), [[0, { opacity: 1 }], [800, { opacity: 1 }], [801, { opacity: 0 }]], INTRO, intro);

    // ---- The tear --------------------------------------------------------
    // It opens from the top of the tear first (a turn about the bottom corner),
    // then lets go and drifts off as it fades.
    play(q("[data-part=body]"), [
      [0, { transform: "translate(0px, 0px) rotate(0deg)" }],
      [800, { transform: "translate(0px, 0px) rotate(0deg)" }, "cubic-bezier(0.45, 0, 0.55, 1)"],
      [1000, { transform: "translate(1px, 0px) rotate(2.4deg)" }, "cubic-bezier(0.3, 0, 0.1, 1)"],
      [1600, { transform: "translate(64px, 12px) rotate(8deg)" }], // stays on screen at 320px
    ], INTRO, intro);
    play(q("[data-part=bodyFade]"), [[0, { opacity: 1 }], [1100, { opacity: 1 }, "cubic-bezier(0.4, 0, 1, 1)"], [1520, { opacity: 0 }]], INTRO, intro);

    // ---- The counterfoil: still, then the full logo ---------------------
    // The ticket enters with its stub (the mark) already at the centre, so after
    // the tear the mark does not travel: it stays still, then steps left once,
    // into the lockup.
    play(q("[data-part=track]"), [
      [0, { transform: "translateX(213px)" }],
      [1400, { transform: "translateX(213px)" }, SETTLE],
      [2500, { transform: "translateX(0px)" }],
    ], INTRO, intro);
    // The wordmark rides with the mark and drifts out from behind its edge
    // (clipped there, so a letter can never show over or left of the mark).
    // One motion for the word, and opacity alone for the letters: long fades
    // that overlap heavily, so the letters arrive one after another as one calm
    // wave rather than as separate pops.
    play(q("[data-part=word]"), [[0, { transform: "translateX(-40px)" }], [1450, { transform: "translateX(-40px)" }, DRIFT], [2600, { transform: "translateX(0px)" }]], INTRO, intro);
    el.querySelectorAll("[data-part=letter]").forEach((l, i) => {
      const at = 1500 + i * 48;
      play(l, [[0, { opacity: 0 }], [at, { opacity: 0 }, SOFT], [at + 700, { opacity: 1 }]], INTRO, intro);
    });

    // ---- The hand-over -----------------------------------------------------
    // The finished logo flies to the card's logo (the same drawing, so the swap
    // at the end is invisible) and the card rises under it.
    const reveal = (skip: boolean) => {
      if (revealing) return;
      revealing = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onSkip);
      window.removeEventListener("pointerdown", onSkip);
      if (skip) intro.forEach((a) => a.finish());


      const flight = q("[data-part=flight]");
      const svg = q("svg");
      const target = document.querySelector("[data-auth-logo] svg");
      // How far the card rises: exactly as far as the logo travels up, on the
      // same curve, so the logo's slot stays under the flying logo all the way.
      let rise = 56;
      if (flight && svg && target) {
        const fr = flight.getBoundingClientRect();
        const sr = svg.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        const s = tr.width / sr.width;
        const tx = tr.left - fr.left - s * (sr.left - fr.left);
        const ty = tr.top - fr.top - s * (sr.top - fr.top);
        rise = Math.max(56, sr.top + sr.height / 2 - (tr.top + tr.height / 2));
        once(flight, { transform: "translate(0px, 0px) scale(1)" }, { transform: `translate(${tx}px, ${ty}px) scale(${s})` }, HAND, 0, FLOW, page);
      } else {
        once(flight, { opacity: 1 }, { opacity: 0 }, 400, 0, "ease-out", page);
      }
      once(q("[data-part=scrim]"), { opacity: 1 }, { opacity: 0 }, 560, 120, IN_OUT, page);

      const card = document.querySelector("[data-auth-reveal=card]");
      once(card, { transform: `translateY(${rise}px)` }, { transform: "translateY(0px)" }, HAND, 0, FLOW, page);
      once(card, { opacity: 0 }, { opacity: 1 }, 420, 100, "ease-out", page);
      card?.querySelectorAll("form > *").forEach((c, i) => {
        once(c, { opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0px)" }, 650, 300 + i * 55, OUT, page);
      });
      once(document.querySelector("[data-auth-reveal=panel]"), { opacity: 1, clipPath: "inset(100% 0 0 0)" }, { opacity: 1, clipPath: "inset(0% 0 0 0)" }, 1000, 0, WIPE, page);
      document.querySelectorAll("[data-auth-reveal=chrome]").forEach((c) => once(c, { opacity: 0 }, { opacity: 1 }, 600, 400, "ease-out", page));
      settle();
    };
    const onSkip = () => reveal(true);

    timer = window.setTimeout(() => reveal(false), HAND_AT);
    window.addEventListener("keydown", onSkip);
    window.addEventListener("pointerdown", onSkip);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onSkip);
      window.removeEventListener("pointerdown", onSkip);
      intro.forEach((a) => a.cancel());
      page.forEach((a) => a.cancel());
    };
  }, [active]);

  if (!active) return null;

  return (
    <div ref={root} className={m.root} data-signout-intro>
      <div className={m.scrim} data-part="scrim" />
      {signedOut && <p className="sr-only" role="status">{t("status")}</p>}
      <div className={m.flight} data-part="flight">
        <svg viewBox="0 0 496 70" className={m.stage} aria-hidden fill="currentColor" overflow="visible">
          <defs>
            {/* Everything right of the mark's tooth tips: where the wordmark may show. */}
            <clipPath id="cf-signout-word" clipPathUnits="userSpaceOnUse">
              <rect x="72" y="-20" width="440" height="110" />
            </clipPath>
          </defs>
          <g className={m.track} data-part="track">
            <g className={m.enter} data-part="enter">
              <path d={SEAM} className={m.seam} data-part="seam" />
              <g data-part="bodyFade">
                <g className={m.body} data-part="body"><path d={BODY} /></g>
              </g>
              <path d={LOGO_MARK} />
              {HOLES.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" className={m.hole} data-part="hole" />)}
            </g>
            <g clipPath="url(#cf-signout-word)">
              <g data-part="word">
                {LOGO_LETTERS.map((d) => <path key={d.slice(0, 16)} d={d} className={m.letter} data-part="letter" />)}
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
