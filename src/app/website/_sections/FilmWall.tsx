"use client";

import { useRef, type CSSProperties } from "react";
import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/cn";
import { SplitReveal } from "../_components/fx";
import { Label, Section } from "../_components/ui";
import { useScrollProgress } from "../_components/motion";
import styles from "./Stage.module.css";
import goBkash from "../../deck/_media/go-bkash.jpg";
import goCart from "../../deck/_media/go-cart.jpg";
import goCash from "../../deck/_media/go-cash.jpg";
import goPin from "../../deck/_media/go-pin.jpg";
import goScan from "../../deck/_media/go-scan.jpg";
import goSheetCinema from "../../deck/_media/go-sheet-cinema.jpg";
import goSheetLane from "../../deck/_media/go-sheet-lane.jpg";
import goSheetShow from "../../deck/_media/go-sheet-show.jpg";
import turf from "../../deck/_media/web-turfcup-phone.jpg";
import osBookings from "../../deck/_media/os-bookings.jpg";
import osCalendar from "../../deck/_media/os-calendar-light.jpg";
import osCustomers from "../../deck/_media/os-customers.jpg";
import osDash from "../../deck/_media/os-dashboard-light.jpg";
import osOrders from "../../deck/_media/os-orders.jpg";
import osSettings from "../../deck/_media/os-settings.jpg";

type Tile = { src: string | StaticImageData; phone: boolean };
const P = (n: string): Tile => ({ src: `/website/${n}.jpg`, phone: true });
const D = (n: string): Tile => ({ src: `/website/${n}.jpg`, phone: false });
const gp = (s: StaticImageData): Tile => ({ src: s, phone: true });
const gd = (s: StaticImageData): Tile => ({ src: s, phone: false });

/* Five columns of the real product: the 12 recordings' posters plus the deck
   screenshots, each lap at its own speed and direction. Columns 4 and 5 are
   hidden on phones (3 columns there). */
const COLS: { tiles: Tile[]; d: number; dir: "normal" | "reverse"; dl: number; hide?: string }[] = [
  { tiles: [P("go-sell"), D("os-dashboard"), gp(goBkash), gd(osOrders), P("go-seats")], d: 70, dir: "normal", dl: -8 },
  { tiles: [gd(osCalendar), P("go-slot"), gp(goCart), D("os-calendar"), gp(goSheetLane)], d: 90, dir: "reverse", dl: -30 },
  { tiles: [P("go-scan"), gp(goScan), D("os-customers"), P("go-checkin"), gd(osSettings)], d: 60, dir: "normal", dl: -20 },
  { tiles: [gd(osDash), P("go-cash"), gp(goCash), D("os-catalog"), gp(goSheetShow)], d: 80, dir: "reverse", dl: -45, hide: "hidden sm:flex" },
  { tiles: [P("go-bangla"), gd(osBookings), gp(goPin), D("os-analytics"), gp(goSheetCinema), gp(turf), gd(osCustomers)], d: 100, dir: "normal", dl: -12, hide: "hidden md:flex" },
];

const MASK = "radial-gradient(ellipse 80% 75% at 50% 50%, #000 45%, transparent 100%)";

function TileView({ t }: { t: Tile }) {
  const img =
    typeof t.src === "string" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={t.src} alt="" loading="eager" decoding="async" className="block h-full w-full object-cover object-top" />
    ) : (
      <Image src={t.src} alt="" sizes="220px" loading="eager" className="block h-full w-full object-cover object-top" />
    );
  return (
    <div className="pb-3 sm:pb-4">
      {t.phone ? (
        <div className="mx-auto w-[88%] rounded-[16px] bg-[#121211] p-[3px] shadow-[0_24px_40px_-20px_rgb(60_20_0/0.45)] sm:rounded-[22px] sm:p-1">
          <div className="aspect-[9/19] overflow-hidden rounded-[13px] sm:rounded-[18px]">{img}</div>
        </div>
      ) : (
        <div className="aspect-[16/10] overflow-hidden rounded-lg bg-white shadow-[0_24px_40px_-22px_rgb(60_20_0/0.4)] sm:rounded-xl">{img}</div>
      )}
    </div>
  );
}

/** A full-bleed, tilted, endlessly scrolling wall of the real product. */
export function FilmWall() {
  const ref = useRef<HTMLDivElement>(null);
  useScrollProgress(ref);
  return (
    <Section id="wall" label="Every screen, real" flush className="overflow-x-clip py-16 md:py-24">
      <div ref={ref} className="relative h-[620px] overflow-hidden sm:h-[720px] md:h-[820px]" style={{ maskImage: MASK, WebkitMaskImage: MASK }}>
        <div aria-hidden className="absolute inset-0 [perspective:1400px]">
          <div className={cn(styles.wallTilt, "absolute -inset-x-[12%] -inset-y-[20%] flex justify-center gap-3 sm:gap-4 md:gap-5")}>
            {COLS.map((c, i) => (
              <div key={i} className={cn("w-[30%] shrink-0 flex-col sm:w-[22%] md:w-[17%]", c.hide ?? "flex")} style={{ marginTop: i % 2 ? "-8%" : "0" }}>
                <div className={styles.wallTrack} style={{ "--d": `${c.d}s`, "--dir": c.dir, "--dl": `${c.dl}s` } as CSSProperties}>
                  {[0, 1].map((k) => c.tiles.map((t, j) => <TileView key={`${k}-${j}`} t={t} />))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[75%] w-[120%] max-w-[1100px] -translate-x-1/2 -translate-y-1/2" style={{ background: "radial-gradient(closest-side, rgb(255 255 255 / 0.95) 35%, rgb(255 255 255 / 0))" }} />
        <div className="absolute inset-0 z-10 grid place-items-center px-5 text-center">
          <div className="max-w-[860px]">
            <div className="mb-5 flex justify-center">
              <Label>Every screen, real</Label>
            </div>
            <SplitReveal
              as="h2"
              className="text-[clamp(2.25rem,7vw,5.5rem)] font-semibold leading-[1] tracking-[-0.045em] text-[var(--cf-fg)] [text-wrap:balance]"
              parts={[{ text: "Every screen you see here " }, { text: "is real.", className: "cf-accent" }]}
            />
            <p className="cf-lead mx-auto mt-5 max-w-[480px]">Filmed from the running product — not a mockup in sight.</p>
          </div>
        </div>
      </div>
    </Section>
  );
}
