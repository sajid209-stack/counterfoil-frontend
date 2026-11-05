import { T } from "../../_components/type";

export interface MethodRow {
  key: string;
  label: string;
  amount: string;
  /** "3 sales · 100%" — the numbers the bar is a picture of. */
  meta: string;
  /** The bar, said in words: "100% cash". */
  share: string;
  pct: number;
}

/** One row per payment method used: name and amount over a bar that is its
 *  share of the period, and the count and share written under it. The bar is a
 *  picture of the numbers, never the only copy. */
export function MethodBars({ rows }: { rows: MethodRow[] }) {
  return (
    <ul className="flex flex-col gap-comfortable">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-inline">
          <div className="flex items-baseline justify-between gap-tight">
            <span className={`${T.body} font-medium`}>{r.label}</span>
            <span className={T.price}>{r.amount}</span>
          </div>
          <div role="img" aria-label={r.share} className="h-2 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-ember-solid" style={{ width: `${r.pct}%` }} />
          </div>
          <span className={T.meta}>{r.meta}</span>
        </li>
      ))}
    </ul>
  );
}
