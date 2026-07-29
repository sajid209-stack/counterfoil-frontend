import { ok } from "./client";
import type { ApiResult } from "./types";

export interface WaitlistEntry {
  productId: string;
  slotStart: string;
  name: string;
  phone: string;
}

const entries: WaitlistEntry[] = [];

/** Capture a waitlist request when a slot is full. */
export async function joinWaitlist(entry: WaitlistEntry): Promise<ApiResult<WaitlistEntry>> {
  entries.push(entry);
  return ok(entry);
}

export const peekWaitlist = (): WaitlistEntry[] => entries;
