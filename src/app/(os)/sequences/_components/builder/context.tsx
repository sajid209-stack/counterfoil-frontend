"use client";

import { createContext, useContext } from "react";
import type { SeqT, SequenceInput, SequenceProblem, Slot } from "@/lib/sequences";

/** "start", a step id, or nothing. */
export type Selected = "start" | string | null;

export interface BuilderCtx {
  form: SequenceInput;
  problems: SequenceProblem[];
  selected: Selected;
  select: (next: Selected) => void;
  change: (patch: Partial<SequenceInput>) => void;
  /** Open the "Add a step" list for a place in the flow. */
  addAt: (slot: Slot) => void;
  canAdd: boolean;
  /** Step number by step id (waits and "if" are not numbered). */
  numbers: Record<string, number>;
  ts: SeqT;
  tb: SeqT;
  venue: string;
  isNew: boolean;
  /** Puts focus in the name field. */
  focusName: () => void;
}

const Ctx = createContext<BuilderCtx | null>(null);
export const BuilderProvider = Ctx.Provider;
export function useBuilder(): BuilderCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useBuilder must be used inside the builder.");
  return c;
}
