export interface MethodRow {
  key: string;
  label: string;
  amount: string;
  count: string;
  pct: number;
}

/** One row per payment method: name and amount over a bar that is its share of
 *  the day. The bar is a picture of the numbers beside it, never the only copy. */
export function MethodBars({ rows }: { rows: MethodRow[] }) {
  return (
    <ul className="flex flex-col gap-comfortable">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-inline">
          <div className="flex items-baseline justify-between gap-tight">
            <span className="text-base font-medium">{r.label}</span>
            <span className="text-base font-semibold tabular-nums">{r.amount}</span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-ember-solid" style={{ width: `${r.pct}%` }} />
          </div>
          <span className="text-sm text-muted">{r.count} · {r.pct}%</span>
        </li>
      ))}
    </ul>
  );
}
