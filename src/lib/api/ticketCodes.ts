import { ok } from "./client";
import type { ApiResult, TicketCodeSettings } from "./types";

/*
 * What a ticket carries, and what the till listens for (ticketcodes.v1).
 *
 * A ticket has always had a QR, which is right for a phone camera and for the
 * imager on a modern gate scanner — and wrong for the hardware most counters
 * in Bangladesh actually own. A cheap laser handheld reads linear barcodes and
 * cannot see a QR at all, so a venue with one had no way to scan its own
 * tickets. Hence the choice, rather than a second thing printed on every
 * ticket whether it is wanted or not: paper and stub width are finite.
 *
 * `scanToSell` is the other end of the same wire. The shop has carried a SKU
 * per item since inventory arrived and nothing ever read it, so a counter
 * selling bottled water had to find the tile. With this on, the till listens
 * for the scanner the venue already has.
 */
const seed: TicketCodeSettings = {
  print: "qr",
  showText: true,
  scanToSell: false,
};

let state: TicketCodeSettings = structuredClone(seed);

const pause = () => new Promise((r) => setTimeout(r, 200));

export async function getTicketCodeSettings(): Promise<ApiResult<TicketCodeSettings>> {
  await pause();
  return ok(structuredClone(state));
}

export async function updateTicketCodeSettings(patch: Partial<TicketCodeSettings>): Promise<ApiResult<TicketCodeSettings>> {
  await pause();
  state = { ...state, ...structuredClone(patch) };
  return ok(structuredClone(state));
}

/** The current settings, synchronously — for the pages that print. */
export const peekTicketCodeSettings = (): TicketCodeSettings => state;
