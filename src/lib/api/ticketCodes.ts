import { ok } from "./client";
import type { ApiResult, TicketCodeSettings } from "./types";

/*
 * What a ticket carries, and what the till listens for (ticketcodes.v1).
 *
 * A ticket carries a QR and nothing else. For a while the owner could choose a
 * Code 39 barcode instead, or both, for the cheap laser handhelds that cannot
 * see a QR; on 2026-10-06 that choice was removed at the owner's request, so
 * the QR is the only code a ticket prints. `print` stays on the record, fixed
 * at "qr", and every read goes through `normalise`, so a setting saved by an
 * earlier build ("barcode" or "both") reads as a QR rather than breaking a
 * print page. The gate's keyboard-wedge scanner path is unchanged: a wedge
 * scanner types the code, whatever it was read from.
 *
 * `scanToSell` is the other end of the same wire, and about the shop rather
 * than tickets. The shop has carried a SKU per item since inventory arrived and
 * nothing ever read it, so a counter selling bottled water had to find the
 * tile. With this on, the till listens for the scanner the venue already has.
 */
const seed: TicketCodeSettings = {
  print: "qr",
  showText: true,
  scanToSell: false,
};

let state: TicketCodeSettings = structuredClone(seed);

/** Whatever was stored, read as it must be now: always a QR. */
const normalise = (s: TicketCodeSettings): TicketCodeSettings => ({ ...s, print: "qr" });

const pause = () => new Promise((r) => setTimeout(r, 200));

export async function getTicketCodeSettings(): Promise<ApiResult<TicketCodeSettings>> {
  await pause();
  return ok(normalise(structuredClone(state)));
}

export async function updateTicketCodeSettings(patch: Partial<TicketCodeSettings>): Promise<ApiResult<TicketCodeSettings>> {
  await pause();
  state = normalise({ ...state, ...structuredClone(patch) });
  return ok(structuredClone(state));
}

/** The current settings, synchronously — for the pages that print. */
export const peekTicketCodeSettings = (): TicketCodeSettings => normalise(state);
