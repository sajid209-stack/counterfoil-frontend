import { Clapperboard, Coffee, Compass, Disc3, Flower2, Landmark, Trophy, Waves, type LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

const VENUES: { icon: LucideIcon; label: string }[] = [
  { icon: Landmark, label: "Museums & heritage" },
  { icon: Trophy, label: "Turf & courts" },
  { icon: Disc3, label: "Bowling" },
  { icon: Flower2, label: "Spas" },
  { icon: Clapperboard, label: "Cinemas" },
  { icon: Compass, label: "Guided tours" },
  { icon: Waves, label: "Pools & classes" },
  { icon: Coffee, label: "Cafés & events" },
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {VENUES.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-2.5 pr-12 text-[15px] text-[var(--w-muted-ink)]">
          <Icon size={18} strokeWidth={1.6} aria-hidden className="text-[var(--w-ember-soft)]" />
          <span className="whitespace-nowrap">{label}</span>
        </li>
      ))}
    </ul>
  );
}

export function HeroMarquee() {
  return (
    <div className="mt-16 md:mt-24">
      <p className="w-eyebrow text-center text-[var(--w-muted-ink)]">Built for the places that sell time</p>
      <div className="mt-6 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
        <div className="w-marquee flex w-max" style={{ "--w-marquee": "60s" } as CSSProperties}>
          <Row />
          <Row hidden />
        </div>
      </div>
    </div>
  );
}
