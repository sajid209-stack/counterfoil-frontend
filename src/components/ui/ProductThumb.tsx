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
  size?: "thumb" | "chip";
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = images?.[0]?.url;
  const Icon = fallbackIcon(bookingType);
  const iconSize = size === "chip" ? 18 : 24;

  const shape =
    size === "chip"
      ? "h-10 w-10 shrink-0 rounded-xs"
      : "h-[72px] w-[72px] shrink-0 rounded-xs";

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
