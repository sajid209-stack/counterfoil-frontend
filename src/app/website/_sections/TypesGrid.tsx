"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useInView } from "../_components/motion";
import { Micro } from "./TypesMicro";
import { WAYS, type Way } from "./TypesData";

function Tile({ way, index }: { way: Way; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref);
  // Remounting the micro on hover replays it from the start.
  const [run, setRun] = useState(0);
  const Icon = way.icon;
  return (
    <li
      ref={ref}
      data-reveal
      style={{ "--w-delay": `${(index % 4) * 70}ms` } as CSSProperties}
      onPointerEnter={() => setRun((r) => r + 1)}
      className="group flex flex-col rounded-[20px] bg-[var(--w-paper)] p-4 shadow-[inset_0_0_0_1px_var(--w-line)] transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[inset_0_0_0_1px_var(--w-muted)] md:p-5"
    >
      <span className="grid h-10 w-10 place-items-center rounded-[11px] bg-[var(--w-white)] text-[var(--w-ember-text)] shadow-[inset_0_0_0_1px_var(--w-line)]">
        <Icon aria-hidden size={20} strokeWidth={1.6} />
      </span>
      <h3 className="mt-4 text-[16px] font-semibold leading-tight tracking-[-0.02em] md:text-[17px]">{way.name}</h3>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--w-muted)]">{way.example}</p>
      <div className="mt-auto pt-5">
        <Micro key={run} kind={way.micro} n={way.n} play={seen} />
      </div>
    </li>
  );
}

export function TypesGrid() {
  return (
    <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {WAYS.map((w, i) => (
        <Tile key={w.id} way={w} index={i} />
      ))}
    </ul>
  );
}
