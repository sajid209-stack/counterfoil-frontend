import { LOGO_H, LOGO_LETTERS, LOGO_MARK, LOGO_W } from "./logoArt";

/**
 * The Counterfoil lockup as vector artwork in the current text colour, so it is
 * ink in light mode and paper in dark without a second file. Sign-in uses it
 * because the sign-out motion lands on exactly this drawing; the PNG `Logo`
 * is an older cut with a larger mark and would not line up.
 */
export function LogoLockup({ height = 20, className, ...rest }: { height?: number; className?: string } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_W} ${LOGO_H}`}
      height={height}
      width={(height * LOGO_W) / LOGO_H}
      fill="currentColor"
      role="img"
      aria-label="Counterfoil"
      className={className}
      {...rest}
    >
      <path d={LOGO_MARK} />
      {LOGO_LETTERS.map((d) => <path key={d.slice(0, 16)} d={d} />)}
    </svg>
  );
}
