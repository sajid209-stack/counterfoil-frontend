"use client";

/**
 * The storefront's small shared kit: the themed root, one button style, and the
 * picture-or-plate used for every venue and booking image.
 *
 * The rule for pictures: a booking without a photo gets a designed plate at
 * the SAME aspect ratio as a photo, never a small glyph in a big box. A plain
 * wash alone reads as a photo that failed to load, so every plate carries a
 * pattern, an icon in a white disc, and a different arrangement per booking
 * (chosen from its id) so a grid of them reads as a set, not a copy.
 */
import { useState } from "react";
import {
  Armchair,
  CalendarClock,
  CreditCard,
  GraduationCap,
  Layers,
  MapPin,
  Ticket,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { storefrontVars } from "@/lib/storefront/theme";
import type { AccentColor, BookingTypeCode } from "@/lib/api/types";

/** The themed root every storefront screen sits in. */
export function SfRoot({
  accent,
  className,
  children,
}: {
  accent: AccentColor | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("sf min-h-screen", className)} style={storefrontVars(accent)}>
      {children}
    </div>
  );
}

/* ── Buttons: one primary style, one secondary ─────────────────────────────
   48px tall (a 44px target with room), 12px corners, 16px semibold. The fill is
   the venue's accent, already nudged until its text reads at 4.5:1. */
const BTN_BASE =
  "inline-flex min-h-12 items-center justify-center gap-tight rounded-[12px] px-major text-[16px] font-semibold leading-none transition-[background-color,box-shadow,opacity] duration-quick focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed";
export const sfBtn = {
  primary: cn(
    BTN_BASE,
    "bg-[var(--sf-fill)] text-[var(--sf-on-fill)] hover:brightness-90 disabled:bg-[#e6e6e2] disabled:text-[#595959] disabled:hover:brightness-100",
  ),
  secondary: cn(
    BTN_BASE,
    "border border-strong bg-white text-fg hover:border-fg disabled:border-line disabled:text-[#6b6b6b]",
  ),
  /** A quiet text link-button: 44px target, accent ink. */
  link: "inline-flex min-h-11 items-center gap-inline text-[14px] font-semibold text-[var(--sf-ink)] underline-offset-4 hover:underline",
};

/* ── Booking groups, for the filter row ─────────────────────────────────── */
export type TypeGroup = "entry" | "timed" | "space" | "packs";
export function typeGroup(bt: BookingTypeCode): TypeGroup {
  switch (bt) {
    case "BT-04":
    case "BT-05":
      return "space";
    case "BT-03":
    case "BT-09":
    case "BT-10":
    case "BT-07":
    case "BT-13":
      return "timed";
    case "BT-02":
    case "BT-08":
    case "BT-12":
    case "BT-14":
      return "packs";
    default:
      return "entry";
  }
}
export const GROUP_ORDER: TypeGroup[] = ["entry", "timed", "space", "packs"];

export function TypeIcon({ bookingType, size }: { bookingType?: BookingTypeCode; size: number }) {
  const p = { size, strokeWidth: 1.5 };
  switch (bookingType) {
    case "BT-03":
    case "BT-06":
      return <Timer {...p} />;
    case "BT-04":
    case "BT-05":
      return <MapPin {...p} />;
    case "BT-07":
      return <Armchair {...p} />;
    case "BT-08":
      return <Layers {...p} />;
    case "BT-09":
    case "BT-10":
      return <Users {...p} />;
    case "BT-12":
      return <CreditCard {...p} />;
    case "BT-13":
      return <GraduationCap {...p} />;
    case "BT-14":
      return <CalendarClock {...p} />;
    default:
      return <Ticket {...p} />;
  }
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Four patterns, drawn in the accent at low strength. Decorative, so they
 *  carry no text and no meaning. */
function Pattern({ kind }: { kind: number }) {
  const c = "var(--sf-accent)";
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" fill="none">
      {kind === 0 && (
        <g stroke={c} strokeOpacity=".22" strokeWidth="1.5">
          {[60, 110, 160, 210, 260, 310].map((r) => (
            <circle key={r} cx="360" cy="40" r={r} />
          ))}
        </g>
      )}
      {kind === 1 && (
        <g stroke={c} strokeOpacity=".2" strokeWidth="1.5">
          {Array.from({ length: 22 }, (_, i) => (
            <line key={i} x1={i * 26 - 120} y1="320" x2={i * 26 + 80} y2="-20" />
          ))}
        </g>
      )}
      {kind === 2 && (
        <g fill={c} fillOpacity=".26">
          {Array.from({ length: 11 }, (_, r) =>
            Array.from({ length: 15 }, (_, k) => <circle key={`${r}-${k}`} cx={k * 28 + 8} cy={r * 28 + 8} r="2.2" />),
          )}
        </g>
      )}
      {kind === 3 && (
        <g stroke={c} strokeOpacity=".22" strokeWidth="1.5">
          {[40, 80, 120, 160, 200, 240].map((r) => (
            <path key={r} d={`M ${-20} ${300 - r} A ${r + 140} ${r + 140} 0 0 1 ${420} ${300 - r * 0.2}`} />
          ))}
        </g>
      )}
    </svg>
  );
}

/**
 * A booking's picture, or a designed plate in its place.
 *
 * `fixedSize` is for thumbnails that size themselves (the basket row); the
 * default fills its box, whose aspect ratio the caller sets with a class so a
 * photo and a plate in the same grid are always the same shape.
 */
export function Media({
  src,
  alt,
  bookingType,
  seed,
  className,
  iconSize = 28,
}: {
  src?: string | null;
  alt: string;
  bookingType?: BookingTypeCode;
  seed: string;
  className?: string;
  iconSize?: number;
}) {
  const [broken, setBroken] = useState(false);
  const h = hash(seed);
  if (src && !broken) {
    return (
      <div className={cn("relative overflow-hidden bg-subtle", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see PROJECT_LOG) */}
        <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  const angle = [135, 160, 120, 200][h % 4];
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: `linear-gradient(${angle}deg, var(--sf-tint-a), var(--sf-tint-b))` }}
    >
      <Pattern kind={h % 4} />
      <span
        aria-hidden
        className="relative flex items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(0,0,0,0.10)] text-[var(--sf-ink)]"
        style={{ width: iconSize * 2.2, height: iconSize * 2.2 }}
      >
        <TypeIcon bookingType={bookingType} size={iconSize} />
      </span>
    </div>
  );
}

/**
 * The hero when the venue has chosen no cover photo: a ticket stub on the
 * accent's own plate. It is plainly drawn (not a photo that failed to load),
 * it says the venue's name in ink on white, and it is on theme for a product
 * that sells tickets.
 */
export function HeroArt({
  src,
  name,
  city,
  seed,
  stub,
  className,
}: {
  src?: string | null;
  name: string;
  city: string;
  seed: string;
  /** "Admit one" in the reader's language. */
  stub: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <div className={cn("relative overflow-hidden bg-subtle", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- bundled/local assets */}
        <img src={src} alt="" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  const h = hash(seed);
  const bars = Array.from({ length: 28 }, (_, i) => 1 + ((h >> (i % 24)) & 3) + (i % 5 === 0 ? 1 : 0));
  return (
    <div
      aria-hidden
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: "linear-gradient(140deg, var(--sf-tint-a), var(--sf-tint-b))" }}
    >
      <Pattern kind={h % 4} />
      <div
        className="relative w-[76%] max-w-[360px] rounded-[16px] bg-white p-comfortable sm:p-section shadow-[0_18px_48px_rgba(0,0,0,0.16)]"
        style={{ transform: "rotate(-3deg)" }}
      >
        <p className="flex items-center gap-tight text-[12px] font-semibold uppercase tracking-[0.08em] text-[#595959]">
          <Ticket size={14} strokeWidth={1.75} /> {stub}
        </p>
        <p className="mt-tight break-words text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[#161616] sm:text-[26px]">{name}</p>
        <p className="mt-inline text-[14px] text-[#595959]">{city}</p>
        <div className="my-comfortable border-t-2 border-dashed border-[#dcdcd8]" />
        <div className="flex h-6 items-stretch sm:h-9 gap-[3px]">
          {bars.map((w, i) => (
            <span key={i} className="bg-[#161616]" style={{ width: w * 1.5 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
