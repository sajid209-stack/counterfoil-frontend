/**
 * Credentials — the scannable token, kept apart from the entitlement.
 *
 * A ticket is the right to come in. A credential is what proves it at the
 * gate. Keeping them apart is the whole point: a guest whose phone is lost, or
 * whose screenshot is circulating in a group chat, needs a NEW token against
 * the SAME sale — not a refund and a re-sale, which moves money, breaks the
 * seat claim and loses the order's history.
 *
 * Two rules hold this together, and the first is what makes the feature real
 * rather than decorative:
 *
 *   1. A scan resolves code → credential → ticket. So a reissue genuinely
 *      stops the old code working. If it did not, "re-issue" would be a button
 *      that printed a second valid ticket, which is worse than no button.
 *   2. At most one credential per ticket is ACTIVE, and `Ticket.code` mirrors
 *      it. Everything that prints, texts or scans keeps reading one field, and
 *      a reissue changes what they all say at once.
 *
 * Credentials are minted on first read rather than at seed time (`sync`), which
 * is the decision the storefront already made: every ticket the generator
 * writes, and every ticket a demo-business swap regenerates, gets its initial
 * credential without anything having to remember to create one alongside it.
 */
import { createResource, fail, notFoundError, ok, validationError } from "./client";
import { DEMO_STAFF_ID } from "@/lib/session";
import { demoNow } from "@/lib/schedule";
import { peekOrders } from "./orders";
import { peekStaff } from "./staff";
import { patchTicket, peekTickets } from "./tickets";
import type {
  ApiResult,
  ID,
  ScanOutcome,
  ScanRefusal,
  Ticket,
  TicketCredential,
  TicketScan,
} from "./types";

const credentials = createResource<TicketCredential>("ticketCredentials", "Credential", {
  search: (c, q) => c.code.toLowerCase().includes(q),
  filter: (c, f) => {
    if (f.ticketId && c.ticketId !== f.ticketId) return false;
    if (f.status && c.status !== f.status) return false;
    return true;
  },
});

const scans = createResource<TicketScan>("ticketScans", "Scan", {
  filter: (s, f) => (f.ticketId ? s.ticketId === f.ticketId : true),
});

/** Who is doing this, unless the caller names somebody else. */
const signedIn = () => peekStaff().find((s) => s.id === DEMO_STAFF_ID)?.name ?? "A manager";

/* ── minting ──────────────────────────────────────────────────────────────── */

/** A fresh scannable code, in the shape a ticket code already has, with the
 *  issue number on the end so a stub says which credential it is. */
function mintCode(ticket: Ticket, issue: number): string {
  const year = ticket.code.match(/\b(20\d\d)\b/)?.[1] ?? String(demoNow().getFullYear());
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `CF-${year}-${digits}-R${issue}`;
}

/**
 * Give every ticket that has none its initial credential.
 *
 * Idempotent and cheap, and called by every read below. The initial
 * credential's code IS the ticket's own, so every stub already printed and
 * every SMS already sent still scans.
 */
function sync(): void {
  const have = new Set(credentials.peek().map((c) => c.ticketId));
  const pending = peekTickets().filter((t) => !have.has(t.id));
  if (!pending.length) return;
  // A ticket is issued by a sale, so the sale's moment is the credential's.
  // `Ticket` carries no timestamp of its own — the type has never declared one
  // and the seed does not write one — and dating the whole seed to the demo's
  // noon would put the same fictional minute on three hundred rows.
  const placed = new Map(peekOrders().map((o) => [o.id, o.createdAt]));
  for (const t of pending) {
    credentials.insert({
      ticketId: t.id,
      code: t.code,
      kind: "qr",
      reason: "initial",
      // A ticket a refund already voided has no live token. Stating it as
      // active and letting the ticket refuse the scan would put a green row
      // under a dead ticket.
      status: t.status === "void" ? "revoked" : "active",
      createdAt: placed.get(t.orderId) ?? demoNow().toISOString(),
      supersededAt: null,
      supersededById: null,
    });
  }
}

/* ── reads ────────────────────────────────────────────────────────────────── */

/** Every credential a ticket has had, oldest first — the audit trail. */
export function credentialsFor(ticketId: ID): TicketCredential[] {
  sync();
  return credentials
    .peek()
    .filter((c) => c.ticketId === ticketId)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The one that scans, if any. */
export function activeCredential(ticketId: ID): TicketCredential | undefined {
  return credentialsFor(ticketId).find((c) => c.status === "active");
}

/** Resolve a scanned code to its credential, whatever state that is in — the
 *  gate needs the superseded one too, so it can say WHY it is refusing. */
export function resolveCredential(code: string): TicketCredential | undefined {
  sync();
  const want = code.trim().toLowerCase();
  if (!want) return undefined;
  // Newest first: a code is unique, but if one were ever reused the live one is
  // the answer.
  return credentials
    .peek()
    .filter((c) => c.code.toLowerCase() === want)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

/* ── writes ───────────────────────────────────────────────────────────────── */

/**
 * Mint a new credential and supersede the one it replaces.
 *
 * The entitlement is untouched: same order, same seat, same money, same
 * admissions already used. What changes is which token opens the gate.
 */
export async function reissueCredential(
  ticketId: ID,
  note: string,
  by?: string,
): Promise<ApiResult<TicketCredential>> {
  const ticket = peekTickets().find((t) => t.id === ticketId);
  if (!ticket) return fail(notFoundError("Ticket"));
  if (!note.trim()) {
    // Never blank: six weeks later an unexplained replacement is
    // indistinguishable from a mistake. Holds and booking locks already hold
    // this rule, for the same reason.
    return fail(validationError({ note: "Say why it is being replaced." }));
  }
  if (ticket.terminatedAt) {
    return fail(validationError({ note: "This ticket was terminated, so there is nothing to replace." }));
  }
  if (ticket.status === "void") {
    return fail(validationError({ note: "This ticket was voided, so there is nothing to replace." }));
  }
  if (ticket.status === "redeemed") {
    // Spent, so a new token opens nothing. A group ticket only part way through
    // is still `issued`, which is the case a reissue genuinely has to serve.
    return fail(validationError({ note: "This ticket has already been used, so a new code would open nothing." }));
  }

  const existing = credentialsFor(ticketId);
  const previous = existing.find((c) => c.status === "active");
  const at = demoNow().toISOString();

  const made = await credentials.create({
    ticketId,
    code: mintCode(ticket, existing.length + 1),
    kind: previous?.kind ?? "qr",
    reason: "reissue",
    status: "active",
    note: note.trim(),
    issuedBy: by ?? signedIn(),
    createdAt: at,
    supersededAt: null,
    supersededById: null,
  } as Omit<TicketCredential, "id">);
  if (!made.ok) return made;

  if (previous) {
    await credentials.update(previous.id, {
      status: "superseded",
      supersededAt: at,
      supersededById: made.data.id,
    });
  }
  // The ticket mirrors its active credential, so the printed stub, the SMS and
  // the gate all read one field and all change together.
  await patchTicket(ticketId, { code: made.data.code });
  return ok(made.data);
}

/**
 * Kill the entitlement by hand, with a reason on the record.
 *
 * Distinct from the `void` a refund writes: no money moved, so the sale stands
 * and the reason is the only explanation there will ever be. Every credential
 * is revoked with it — a terminated ticket whose last code still scanned would
 * be the same lie as a reissue that did not supersede.
 */
export async function terminateTicket(ticketId: ID, reason: string): Promise<ApiResult<Ticket>> {
  const ticket = peekTickets().find((t) => t.id === ticketId);
  if (!ticket) return fail(notFoundError("Ticket"));
  if (!reason.trim()) return fail(validationError({ reason: "Say why it is being terminated." }));
  if (ticket.terminatedAt) return fail(validationError({ reason: "This ticket is already terminated." }));

  const at = demoNow().toISOString();
  for (const c of credentialsFor(ticketId)) {
    if (c.status === "active") await credentials.update(c.id, { status: "revoked", supersededAt: at });
  }
  return patchTicket(ticketId, { status: "void", terminatedAt: at, terminatedReason: reason.trim() });
}

/** Kill every live token on a ticket, without touching the ticket. Called when
 *  a refund voids it: the entitlement is gone, so the code must be too. */
export async function revokeCredentials(ticketId: ID): Promise<void> {
  const at = demoNow().toISOString();
  for (const c of credentialsFor(ticketId)) {
    if (c.status === "active") await credentials.update(c.id, { status: "revoked", supersededAt: at });
  }
}

/* ── the gate's own record ────────────────────────────────────────────────── */

/**
 * Write down a scan, admitted or refused.
 *
 * Refusals are recorded as well as admissions, because "this was turned away
 * four times in a minute" is what a steward needs to see and a counted total
 * cannot say.
 */
export async function recordScan(input: {
  ticketId: ID;
  credentialId?: ID | null;
  outcome: ScanOutcome;
  refusal?: ScanRefusal;
  admitted?: number;
  by?: string;
}): Promise<ApiResult<TicketScan>> {
  return scans.create({
    ...input,
    by: input.by ?? signedIn(),
    at: demoNow().toISOString(),
  } as Omit<TicketScan, "id">);
}

/** One ticket's scans, newest first. */
export function scansFor(ticketId: ID): TicketScan[] {
  return scans
    .peek()
    .filter((s) => s.ticketId === ticketId)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * What happened to this ticket at a gate.
 *
 * Where nothing was recorded but the ticket says it was redeemed, that fact
 * comes back as its own kind — the redemption predates this log, and drawing
 * it as a scan would be inventing a scan nobody recorded.
 */
export type TicketEvent = TicketScan & { source: "scan" | "record" };
export function ticketTimeline(ticket: Ticket): TicketEvent[] {
  const recorded = scansFor(ticket.id).map((s) => ({ ...s, source: "scan" as const }));
  if (recorded.length || !ticket.redeemedAt) return recorded;
  return [
    {
      id: `rec_${ticket.id}`,
      ticketId: ticket.id,
      at: ticket.redeemedAt,
      outcome: "admitted",
      admitted: ticket.admitted,
      source: "record",
    },
  ];
}
