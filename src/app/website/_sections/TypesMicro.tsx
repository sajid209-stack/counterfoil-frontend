import type { CSSProperties } from "react";
import type { Way } from "./TypesData";
import s from "./Types.module.css";

const idx = (i: number) => ({ "--i": i }) as CSSProperties;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** One tiny monochrome loop for a kind of booking. Decorative. */
export function TypesMicro({ way }: { way: Way }) {
  const n = way.n ?? 5;
  switch (way.micro) {
    case "slots":
      return (
        <span aria-hidden className={s.micro}>
          {range(5).map((i) => (
            <span key={i} className={s.slot} style={idx(i)} />
          ))}
        </span>
      );
    case "stretch":
      return (
        <span aria-hidden className={s.micro}>
          <span className={s.track}>
            <span className={s.bar} />
          </span>
        </span>
      );
    case "seats":
      return (
        <span aria-hidden className={s.micro}>
          <span className={s.seats}>
            {range(8).map((i) => (
              <span key={i} className={s.seat} style={idx((i * 3) % 8)} />
            ))}
          </span>
        </span>
      );
    case "credits":
      return (
        <span aria-hidden className={s.micro}>
          {range(5).map((i) => (
            <span key={i} className={s.pip} style={idx(i)} />
          ))}
        </span>
      );
    case "dots":
      return (
        <span aria-hidden className={s.micro}>
          {range(Math.min(n, 5)).map((i) => (
            <span key={i} className={s.dot} style={idx(i)} />
          ))}
        </span>
      );
    default:
      return (
        <span aria-hidden className={s.micro}>
          {range(Math.min(n, 8)).map((i) => (
            <span key={i} className={s.step} style={idx(i)} />
          ))}
        </span>
      );
  }
}
