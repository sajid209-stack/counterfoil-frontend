"use client";

import { useRef, useState } from "react";
import { Armchair, Ban, CalendarClock, ClipboardCheck, Languages, Repeat, ShieldCheck, Users, Check, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Clip, Phone } from "../_components/media";
import { useScrollProgress } from "../_components/motion";
import { Heading, Section } from "../_components/ui";
import { GlassChip, StarBg } from "./Glass";
import styles from "./Scenes.module.css";

type Chip = { icon: LucideIcon; title: string; sub?: string };
type Chapter = { clip: string; title: string; body: string; label: string; chips: [Chip, Chip] };

const CHAPTERS: readonly Chapter[] = [
  {
    clip: "go-slot",
    title: "Book a court",
    body: "Pick the field and the hour on the real grid, repeat it weekly, and every date is checked against live capacity before it sells.",
    label: "Counterfoil Go: a court time grid with repeat weekly",
    chips: [
      { icon: CalendarClock, title: "Indoor Field · 2 PM", sub: "৳1,500 an hour" },
      { icon: Repeat, title: "4 weeks · ৳6,000", sub: "Repeat weekly" },
    ],
  },
  {
    clip: "go-seats",
    title: "Pick the seats",
    body: "A real seat map at the counter. Tap the seats the guest wants and they are theirs, never sold twice.",
    label: "Counterfoil Go: a seat map with seats being picked",
    chips: [
      { icon: Armchair, title: "C6 · C7 · C8", sub: "৳1,200.00" },
      { icon: ShieldCheck, title: "Never sold twice" },
    ],
  },
  {
    clip: "go-scan",
    title: "Scan the whole family in",
    body: "One family ticket admits all four. Scan it again and the gate refuses, clearly, in words and shape.",
    label: "Counterfoil Go: scanning a family ticket, admitting four, then refusing a re-scan",
    chips: [
      { icon: Users, title: "Let all 4 in", sub: "One family ticket" },
      { icon: Ban, title: "Already used", sub: "The re-scan is refused" },
    ],
  },
  {
    clip: "go-checkin",
    title: "Check in at the desk",
    body: "The day's roster, by session. Find a booking, check the group in, take any balance owing.",
    label: "Counterfoil Go: the check-in roster",
    chips: [
      { icon: ClipboardCheck, title: "Kamrul Hasan", sub: "2 of 2 in" },
      { icon: Check, title: "Party of 10", sub: "Checked in, one tap" },
    ],
  },
  {
    clip: "go-bangla",
    title: "Speak Bangla",
    body: "The whole till switches to Bangla for the staff who work in it, with the same buttons in the same places.",
    label: "Counterfoil Go: the till in Bangla",
    chips: [
      { icon: Languages, title: "বাংলা", sub: "Whole till" },
      { icon: Check, title: "Same layout" },
    ],
  },
];

/** The scroll-driven Go story: a sticky phone floating in space on desktop, stacked phones below. */
export function PhoneStory() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const last = useRef(0);
  useScrollProgress(track, {
    from: "top",
    onChange: (p) => {
      const i = Math.min(CHAPTERS.length - 1, Math.floor(p * CHAPTERS.length));
      if (i !== last.current) {
        last.current = i;
        setActive(i);
      }
    },
  });

  return (
    <Section id="platform" flush className="overflow-x-clip bg-black">
      <StarBg />
      <div className="relative px-5 pb-10 pt-20 md:px-12 md:pt-28 lg:pb-0">
        <Heading align="center" label="Counterfoil Go" title="The till" dim="in your hand." />
      </div>

      {/* lg+: sticky phone, chapters scroll past on alternating sides */}
      <div ref={track} className="relative mx-auto hidden max-w-[1200px] px-12 lg:block">
        <div className="pointer-events-none sticky top-0 z-10 flex h-screen items-center justify-center">
          <div className={cn("relative w-[290px]", styles.float)}>
            {/* orbit rings, tilted back */}
            <div aria-hidden className="absolute left-1/2 top-1/2 h-0 w-0 [perspective:1000px]">
              <div className="absolute -left-[250px] -top-[250px] h-[500px] w-[500px] [transform:rotateX(72deg)]">
                <div className={cn("relative h-full w-full rounded-full border border-white/15", styles.spin)}>
                  <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--cf-accent)] shadow-[0_0_14px_3px_var(--cf-glow)]" />
                </div>
              </div>
              <div className="absolute -left-[330px] -top-[330px] h-[660px] w-[660px] [transform:rotateX(72deg)]">
                <div className={cn("h-full w-full rounded-full border border-dashed border-white/10", styles.spinRev)} />
              </div>
            </div>
            {/* ember glow under the phone */}
            <div aria-hidden className={cn("absolute -bottom-14 left-1/2 h-[70px] w-[300px] -translate-x-1/2 rounded-full bg-[rgb(249_74_0/0.55)] blur-[50px]", styles.glow)} />
            <div data-spark className="relative">
              <Phone>
                <div className="relative h-full w-full">
                  {CHAPTERS.map((c, i) => (
                    <div key={c.clip} className={cn("absolute inset-0 transition-opacity duration-500", i === active ? "opacity-100" : "opacity-0")}>
                      <Clip name={c.clip} label={c.label} playing={i === active} />
                    </div>
                  ))}
                </div>
              </Phone>
            </div>
            {CHAPTERS.map((c, i) => {
              const right = i % 2 === 0; // text on the left, chips on the right
              return c.chips.map((chip, k) => (
                <div
                  key={`${c.clip}-${k}`}
                  aria-hidden={i !== active}
                  className={cn(
                    "absolute transition-[opacity,transform] duration-500",
                    right ? "left-full ml-14" : "right-full mr-14",
                    k === 0 ? "top-[24%]" : "top-[58%]",
                    k === 1 && (right ? "ml-20" : "mr-20"),
                    i === active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
                  )}
                >
                  <GlassChip title={chip.title} sub={chip.sub} />
                </div>
              ));
            })}
            {/* progress rail */}
            <div aria-hidden className="absolute -left-14 bottom-[12%] top-[12%] w-[2px] rounded-full bg-white/10">
              <div className="absolute left-0 top-0 w-full rounded-full bg-[var(--cf-accent)] shadow-[0_0_10px_var(--cf-glow)] transition-[height] duration-500" style={{ height: `${(active / (CHAPTERS.length - 1)) * 100}%` }} />
              {CHAPTERS.map((c, i) => (
                <span
                  key={c.clip}
                  className={cn("absolute -left-[4px] h-[10px] w-[10px] rounded-full border transition-colors duration-500", i <= active ? "border-[var(--cf-accent)] bg-[var(--cf-accent)]" : "border-white/20 bg-black")}
                  style={{ top: `calc(${(i / (CHAPTERS.length - 1)) * 100}% - 5px)` }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="relative -mt-[100vh]">
          {CHAPTERS.map((c, i) => (
            <div key={c.clip} className={cn("flex h-[90vh] items-center", i % 2 === 0 ? "justify-start" : "justify-end")}>
              <div className={cn("w-[340px] transition-opacity duration-500", i === active ? "opacity-100" : "opacity-30")}>
                <p className="text-[13px] font-medium tracking-wide text-[var(--cf-accent-text)]">0{i + 1}</p>
                <h3 className="mt-2 text-[28px] font-medium leading-tight tracking-tight text-[var(--cf-fg)]">{c.title}</h3>
                <p className="cf-lead mt-3">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* below lg: each chapter stacks its text over its own phone */}
      <div className="relative space-y-20 px-5 pb-20 md:px-12 lg:hidden">
        {CHAPTERS.map((c, i) => (
          <div key={c.clip} className="mx-auto max-w-[520px] text-center">
            <p className="text-[13px] font-medium tracking-wide text-[var(--cf-accent-text)]">0{i + 1}</p>
            <h3 className="mt-2 text-[24px] font-medium leading-tight tracking-tight text-[var(--cf-fg)]">{c.title}</h3>
            <p className="cf-lead mt-3">{c.body}</p>
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {c.chips.map((chip) => (
                <li key={chip.title}>
                  <GlassChip title={chip.title} sub={chip.sub} />
                </li>
              ))}
            </ul>
            <div className="relative mx-auto mt-8 max-w-[280px]">
              <div aria-hidden className="absolute -bottom-8 left-1/2 h-[60px] w-[220px] -translate-x-1/2 rounded-full bg-[rgb(249_74_0/0.5)] blur-[44px]" />
              <div data-spark className="relative">
                <Phone>
                  <Clip name={c.clip} label={c.label} />
                </Phone>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
