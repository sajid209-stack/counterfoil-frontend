"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Slot } from "@/lib/sequences";
import { useBuilder } from "../context";

/** Where the spine runs: 32px in from the card edge on the page, 12px inside a branch column. */
export type Inset = "root" | "lane";
export const INSET_X: Record<Inset, string> = { root: "left-8", lane: "left-3" };
export const INSET_PAD: Record<Inset, string> = { root: "pl-12", lane: "pl-8" };

export const spineLine = (inset: Inset, extra?: string) => cn("absolute w-0.5 -translate-x-1/2 bg-strong", INSET_X[inset], extra);

/** The 28px stretch of spine between two cards, with the add button on it. */
export function Connector({ inset, slot, short = false }: { inset: Inset; slot?: Slot; short?: boolean }) {
  const { tb, addAt, canAdd } = useBuilder();
  return (
    <div className={cn("relative", short ? "h-3" : "h-7")}>
      <span aria-hidden className={spineLine(inset, "inset-y-0")} />
      {slot && canAdd && (
        <button
          type="button"
          aria-label={tb("flow.addStep")}
          onClick={() => addAt(slot)}
          className={cn(
            "absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line bg-card text-fg-secondary transition-colors duration-quick ease-counterfoil hover:bg-muted-wash motion-reduce:transition-none",
            "before:absolute before:-inset-2.5",
            INSET_X[inset],
          )}
        >
          <Plus size={14} strokeWidth={1.5} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The last thing on the spine: a small square and the word "Ends". */
export function EndMarker() {
  const { tb } = useBuilder();
  return (
    <div className="relative flex h-7 items-center gap-tight pl-12 text-sm text-muted">
      <span aria-hidden className={spineLine("root", "top-0 h-1/2")} />
      <span aria-hidden className="absolute left-8 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 bg-strong" />
      {tb("flow.ends")}
    </div>
  );
}
