import { LOGO_MARK } from "@/components/brand/logoArt";
import { VelocityMarquee } from "../_components/fx";
import styles from "./Band.module.css";

/* A giant kinetic type band between sections. Pure decoration: hidden from
   assistive tech, clipped inside its own wrapper so it never widens the page.
   Two rows run opposite ways and lean with the scroll speed. */

const TONES = ["text-[var(--cf-fg)]", "text-[var(--cf-accent)]", "text-[#ece9e3]"];

function Mark({ ember }: { ember: boolean }) {
  return (
    <span aria-hidden className={`${styles.spin} mx-[0.35em] shrink-0 text-[clamp(1.75rem,4.5vw,4.5rem)]`}>
      <svg width="1em" height="1em" viewBox="0 0 70 70" fill={ember ? "#f94a00" : "#111110"} className="block">
        <path d={LOGO_MARK} />
      </svg>
    </span>
  );
}

function Row({ words, offset }: { words: string[]; offset: number }) {
  return words.map((_, i) => {
    const k = (i + offset) % words.length;
    return (
      <span key={i} className="flex shrink-0 items-center">
        <span className={`text-[clamp(4rem,11vw,10rem)] font-bold leading-[1.02] tracking-[-0.05em] ${TONES[(i + offset) % TONES.length]}`}>{words[k]}</span>
        <Mark ember={(i + offset) % 2 === 0} />
      </span>
    );
  });
}

export function Band({ words, reverse = false }: { words: string[]; reverse?: boolean }) {
  const dir = reverse ? -1 : 1;
  return (
    <div role="presentation" aria-hidden className="relative overflow-hidden py-8 md:py-14">
      <div className="-mx-[6%] flex flex-col gap-1 md:gap-3" style={{ transform: "rotate(-2deg)" }}>
        <VelocityMarquee base={50} direction={dir as 1 | -1}>
          <Row words={words} offset={0} />
        </VelocityMarquee>
        <VelocityMarquee base={50} direction={(-dir) as 1 | -1}>
          <Row words={words} offset={2} />
        </VelocityMarquee>
      </div>
    </div>
  );
}
