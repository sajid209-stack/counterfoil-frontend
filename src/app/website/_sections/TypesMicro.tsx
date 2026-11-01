import type { CSSProperties } from "react";
import type { MicroKind } from "./TypesData";
import m from "./Types.module.css";

/** A tiny, decorative CSS animation that shows the kind. Ends in its finished state. */
export function Micro({ kind, n, play }: { kind: MicroKind; n?: number; play: boolean }) {
  const cells = (count: number, cls: string) =>
    Array.from({ length: count }, (_, i) => <span key={i} className={cls} style={{ "--i": i } as CSSProperties} />);
  return (
    <div aria-hidden data-play={play} className={m.micro}>
      {kind === "slots" && <div className={m.slots}>{cells(4, m.slot)}</div>}
      {kind === "stretch" && (
        <div className={m.track}>
          <span className={m.stretch} />
        </div>
      )}
      {kind === "seats" && <div className={m.seats}>{cells(12, m.seat)}</div>}
      {kind === "credits" && <div className={m.credits}>{cells(10, m.credit)}</div>}
      {kind === "dots" && <div className={m.dots}>{cells(n ?? 4, m.dot)}</div>}
      {kind === "steps" && <div className={m.steps}>{cells(n ?? 7, m.step)}</div>}
    </div>
  );
}
