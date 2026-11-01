import { Landmark, Trophy, Disc3, Flower2, Clapperboard, Compass, Waves, Coffee, type LucideIcon } from "lucide-react";

const VENUES: Array<[LucideIcon, string]> = [
  [Landmark, "Museums & heritage"],
  [Trophy, "Turf & courts"],
  [Disc3, "Bowling"],
  [Flower2, "Spas"],
  [Clapperboard, "Cinemas"],
  [Compass, "Guided tours"],
  [Waves, "Pools & classes"],
  [Coffee, "Cafés & events"],
];

function Row({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-12 pr-12">
      {VENUES.map(([Icon, name]) => (
        <li key={name} className="flex items-center gap-2.5 whitespace-nowrap text-[15px] font-medium tracking-tight text-[var(--cf-muted)]">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand-50,#fff5ee)] text-[var(--color-brand-foreground,#aa3000)]"><Icon aria-hidden size={16} strokeWidth={1.7} /></span>
          {name}
        </li>
      ))}
    </ul>
  );
}

/** A quiet strip of the kinds of venue Counterfoil is built for. */
export function HeroVenues() {
  return (
    <div className="mt-14 text-center">
      <p className="cf-label">Built for the places that sell time</p>
      <div
        className="mt-6 overflow-hidden"
        style={{ maskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)", WebkitMaskImage: "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)" }}
      >
        <div className="cf-marquee flex w-max" style={{ "--cf-marquee": "60s" } as React.CSSProperties}>
          <Row />
          <Row hidden />
        </div>
      </div>
    </div>
  );
}
