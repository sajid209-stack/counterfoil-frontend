"use client";

import { useState } from "react";
import {
  Ticket,
  Clock,
  MapPin,
  Users,
  Armchair,
  Layers,
  CreditCard,
  GraduationCap,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { BookingTypeCode, ProductImage } from "@/lib/api/types";

/** Pick a fallback glyph from the booking behaviour, so a product with no
 *  photo still reads at a glance instead of showing a broken image. */
function fallbackIcon(bookingType?: BookingTypeCode): LucideIcon {
  switch (bookingType) {
    case "BT-03":
    case "BT-06":
      return Clock; // timed / capped sessions
    case "BT-04":
    case "BT-05":
      return MapPin; // resource / space booking
    case "BT-07":
      return Armchair; // seat sections
    case "BT-08":
      return Layers; // bundle
    case "BT-09":
    case "BT-10":
      return Users; // guided / provider
    case "BT-12":
      return CreditCard; // credits pack
    case "BT-13":
      return GraduationCap; // course
    case "BT-14":
      return CalendarClock; // pass
    default:
      return Ticket; // plain admission
  }
}

export function ProductThumb({
  images,
  name,
  bookingType,
  size = "thumb",
  className,
}: {
  images?: ProductImage[];
  name: string;
  bookingType?: BookingTypeCode;
  /** thumb = the POS grid square; chip = small square beside a title */
  size?: "thumb" | "card" | "chip";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = images?.[0]?.url;
  const Icon = fallbackIcon(bookingType);
  const iconSize = size === "chip" ? 18 : size === "card" ? 20 : 24;

  const shape =
    // `card` is the Go grid tile: a 44px square in the corner of a product
    // card, small enough that it supports recognition without becoming the
    // card the way a 4:3 photo band once did.
    size === "card"
      ? "h-11 w-11 shrink-0 rounded-go-sm"
      : size === "chip"
      // `chip` is OS (the bookings list, the dashboard) — it keeps the admin
      // app's 3px corner. Only `thumb` follows the Go radii.
      ? "h-10 w-10 shrink-0 rounded-xs"
      // 56px on a phone, 72px from sm. The thumbnail sets the row height in the
      // POS list — at 72 a 390px screen fits five and a half products, at 56 it
      // fits seven. It is recognition support, not the card, so it is the part
      // that should give. `thumb` is used only by the POS grid, so this changes
      // nothing else.
      : "h-14 w-14 shrink-0 rounded-go-sm sm:h-[72px] sm:w-[72px]";

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- bundled/local assets; next/image loader config avoided by design (see PROJECT_LOG)
      <img
        src={src}
        alt={images?.[0]?.alt ?? name}
        loading="lazy"
        onError={() => setBroken(true)}
        className={cn(shape, "object-cover", className)}
      />
    );
  }

  return (
    // In dark mode --color-subtle and --color-card are the same value, so the
    // tile has no edge of its own — the 1px line is what keeps it reading as a
    // tile rather than a glyph floating on the row (dark elevation = surface
    // step + line). muted, not faint: faint on subtle is unreadable in dark.
    <div
      className={cn(
        shape,
        "flex items-center justify-center border border-line bg-subtle text-muted",
        className,
      )}
      aria-hidden
    >
      <Icon size={iconSize} strokeWidth={1.5} />
    </div>
  );
}
