/*
 * Catalog history: what changed on a booking, who changed it, and when.
 * Spec: docs/catalog-history.md.
 *
 * The contract the backend should copy:
 *
 *   ONE revision per save. A save that renames a ticket and changes two prices
 *   is ONE revision with three field changes, never three events. The screen
 *   this replaces wrote one event per field, so one press of Save read as a
 *   wall of separate actions.
 *
 *   Names are snapshotted. A field change on a ticket carries the ticket's name
 *   AS IT WAS, so a later rename or a deleted ticket never turns an old entry
 *   into an id ("changed a ticket type 01a1ddc4").
 *
 *   Values are typed, not pre-written sentences: `{ type: "money", value }`,
 *   `{ type: "status", value: "active" }`. The screen words and formats them in
 *   the reader's language and currency; raw enums (DRAFT → PUBLISHED) never
 *   reach the page.
 *
 *   The actor is nullable. A booking created before tracking began has no
 *   creator on record, and the screen says so once instead of guessing.
 *
 * Revisions are recorded by `updateProduct` / `archiveProduct` (products.ts)
 * through `recordProductChange`, so every path that edits a booking (the record
 * page, the catalog list's on/off switch, Settings → Payment choices, Undo
 * toasts) lands here without each screen remembering to log.
 */
import { delay, ok, fail, notFoundError } from "./client";
import { peekLocations } from "./locations";
import { peekStaff } from "./staff";
import { DEMO_STAFF_ID } from "@/lib/session";
import type { ApiResult, ID, ISODateTime, Minor, PayNowRule, Product, ProductPatch } from "./types";

// ── Contract ────────────────────────────────────────────────────────────────

/** Which part of the record a change belongs to. Drives the filter chips and
 *  the "Open in …" link to the tab that edits it. */
export type CatalogArea = "status" | "details" | "prices" | "where" | "rules" | "payment";

export type CatalogValue =
  | { type: "text"; value: string }
  | { type: "longText"; value: string }
  | { type: "money"; value: Minor }
  | { type: "number"; value: number; unit?: "hours" | "days" | "minutes" | "people" | "years" | "tickets" }
  | { type: "bool"; value: boolean }
  | { type: "status"; value: Product["status"] }
  | { type: "list"; value: string[] }
  | { type: "payNow"; value: PayNowRule | null }
  | null;

export interface CatalogFieldChange {
  /** Stable key: "name", "status", "tier.price", "policies.cancelHours"… */
  field: string;
  area: CatalogArea;
  /** The thing inside the booking that changed, by its name at the time. */
  subject?: { kind: "tier"; id: ID; name: string };
  before: CatalogValue;
  after: CatalogValue;
}

export type CatalogRevisionKind = "created" | "edited" | "archived" | "reverted";

export interface CatalogActor {
  id: ID;
  name: string;
  role?: string;
}

export interface CatalogRevision {
  id: ID;
  productId: ID;
  at: ISODateTime;
  /** null: made before changes were tracked. */
  actor: CatalogActor | null;
  kind: CatalogRevisionKind;
  changes: CatalogFieldChange[];
  /** For a revert: when the changes it undid were made. */
  revertOf?: ISODateTime;
}

// ── Diff ────────────────────────────────────────────────────────────────────

const text = (v: string | undefined | null): CatalogValue => (v ? { type: "text", value: v } : null);
const num = (v: number | undefined | null, unit?: Extract<CatalogValue, { type: "number" }>["unit"]): CatalogValue =>
  v == null ? null : { type: "number", value: v, ...(unit ? { unit } : {}) };
const same = (a: CatalogValue, b: CatalogValue) => JSON.stringify(a) === JSON.stringify(b);

const locationNames = (ids: ID[] | undefined): string[] => {
  const all = peekLocations();
  return (ids ?? []).map((id) => all.find((l) => l.id === id)?.name ?? id).sort();
};

/** The fields history follows, each with how to read it off a product. Kept to
 *  what an operator would recognise; internal bookkeeping (updatedAt, slugs,
 *  derived durations) is not history. */
const FIELDS: { field: string; area: CatalogArea; read: (p: Product) => CatalogValue }[] = [
  { field: "status", area: "status", read: (p) => ({ type: "status", value: p.status }) },
  { field: "name", area: "details", read: (p) => text(p.name) },
  { field: "description", area: "details", read: (p) => (p.description ? { type: "longText", value: p.description } : null) },
  { field: "photos", area: "details", read: (p) => num(p.images?.length ?? 0) },
  { field: "minAge", area: "rules", read: (p) => num(p.minAge, "years") },
  { field: "maxPerOrder", area: "rules", read: (p) => num(p.maxPerOrder, "tickets") },
  { field: "locations", area: "where", read: (p) => ({ type: "list", value: locationNames(p.locationIds) }) },
  { field: "channels", area: "where", read: (p) => ({ type: "list", value: [...(p.channels ?? [])].sort() }) },
  { field: "policies.salesWindowDays", area: "rules", read: (p) => num(p.policies?.salesWindowDays, "days") },
  { field: "policies.cutoffMinutes", area: "rules", read: (p) => num(p.policies?.cutoffMinutes, "minutes") },
  { field: "policies.cancellation", area: "rules", read: (p) => text(p.policies?.cancellation) },
  { field: "policies.cancelHours", area: "rules", read: (p) => num(p.policies?.cancelHours, "hours") },
  { field: "policies.partyMin", area: "rules", read: (p) => num(p.policies?.partyMin, "people") },
  { field: "policies.partyMax", area: "rules", read: (p) => num(p.policies?.partyMax, "people") },
  { field: "policies.waiver", area: "rules", read: (p) => (p.policies ? { type: "bool", value: !!p.policies.waiver } : null) },
  { field: "payNow", area: "payment", read: (p) => ({ type: "payNow", value: p.payNow ?? null }) },
];

/** Every operator-visible difference between two versions of a booking. */
export function diffProduct(before: Product, after: Product): CatalogFieldChange[] {
  const out: CatalogFieldChange[] = [];
  for (const f of FIELDS) {
    const a = f.read(before);
    const b = f.read(after);
    if (!same(a, b)) out.push({ field: f.field, area: f.area, before: a, after: b });
  }
  // Tickets: matched by id, named as they were before the change.
  const old = new Map(before.tiers.map((t) => [t.id, t]));
  const now = new Map(after.tiers.map((t) => [t.id, t]));
  for (const t of after.tiers) {
    const was = old.get(t.id);
    const subject = { kind: "tier" as const, id: t.id, name: was?.name ?? t.name };
    if (!was) {
      out.push({ field: "tier.added", area: "prices", subject, before: null, after: { type: "money", value: t.price } });
      continue;
    }
    if (was.name !== t.name) out.push({ field: "tier.name", area: "prices", subject, before: text(was.name), after: text(t.name) });
    if (was.price !== t.price) out.push({ field: "tier.price", area: "prices", subject, before: { type: "money", value: was.price }, after: { type: "money", value: t.price } });
    if (was.active !== t.active) out.push({ field: "tier.onSale", area: "prices", subject, before: { type: "bool", value: was.active }, after: { type: "bool", value: t.active } });
  }
  for (const t of before.tiers) {
    if (!now.has(t.id)) out.push({ field: "tier.removed", area: "prices", subject: { kind: "tier", id: t.id, name: t.name }, before: { type: "money", value: t.price }, after: null });
  }
  return out;
}

// ── Store ───────────────────────────────────────────────────────────────────

const recorded: CatalogRevision[] = [];
let seq = 0;
/** Set by `revertCatalogChanges` around its own save, so that save is filed
 *  as a revert rather than an ordinary edit. */
let pendingRevert: ISODateTime | null = null;

function currentActor(): CatalogActor {
  const s = peekStaff().find((x) => x.id === DEMO_STAFF_ID);
  return { id: DEMO_STAFF_ID, name: s ? s.name : "You" };
}

/** Called by products.ts after a successful update or archive. */
export function recordProductChange(before: Product, after: Product): void {
  // Freeze the seeded past against the values BEFORE this edit, or it would be
  // rewritten from the new values and contradict this very revision.
  seedOnce(before);
  const changes = diffProduct(before, after);
  if (changes.length === 0) return;
  const kind: CatalogRevisionKind = pendingRevert ? "reverted" : after.status === "archived" && before.status !== "archived" ? "archived" : "edited";
  recorded.push({
    id: `rev_live_${++seq}`,
    productId: after.id,
    at: new Date().toISOString(),
    actor: currentActor(),
    kind,
    changes,
    ...(pendingRevert ? { revertOf: pendingRevert } : {}),
  });
}

// ── Seeded history ──────────────────────────────────────────────────────────
/* The mock has no past, so each booking is given a believable one, written
   BACKWARDS from what it is now: the newest revision ends at today's values,
   so history and record can never disagree. Deterministic per booking.

   It deliberately includes the cases the design has to handle:
   - a save that changed several things at once;
   - a rename made and taken back within minutes (net zero);
   - a price change, publishing, and a rule change;
   - a creation from before tracking began (no creator on record). */

const H = 3_600_000;
const D = 24 * H;
/** When tracking began: anything created before this has no creator. */
const TRACKING_FROM_DAYS = 20;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** An earlier, shorter draft of a description: its first sentence, less its
 *  last few words. */
function shorter(text: string): string {
  const first = text.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
  const words = first.split(" ");
  return `${words.slice(0, Math.max(3, words.length - 3)).join(" ")}.`;
}

function seedFor(p: Product): CatalogRevision[] {
  const staff = peekStaff().filter((s) => s.status === "active");
  const pick = (n: number): CatalogActor | null => {
    if (staff.length === 0) return null;
    const s = staff[n % staff.length];
    return { id: s.id, name: s.name };
  };
  const h = hash(p.id);
  const now = Date.now();
  const created = Date.parse(p.createdAt);
  const out: CatalogRevision[] = [];
  let n = 0;
  const at = (msAgo: number) => new Date(Math.max(created + 60_000, now - msAgo)).toISOString();
  const add = (msAgo: number, actor: CatalogActor | null, changes: CatalogFieldChange[], kind: CatalogRevisionKind = "edited") => {
    if (now - msAgo <= created) return;
    out.push({ id: `rev_seed_${p.id}_${++n}`, productId: p.id, at: at(msAgo), actor, kind, changes });
  };
  const tier = p.tiers[0];
  const lead = pick(h);
  const other = pick(h + 1);

  // 1. A price change, ~1–2 days ago, in the same save as a cancellation rule.
  if (tier && tier.price > 0) {
    const step = Math.max(5000, Math.round(tier.price * 0.2 / 5000) * 5000);
    const changes: CatalogFieldChange[] = [
      { field: "tier.price", area: "prices", subject: { kind: "tier", id: tier.id, name: tier.name }, before: { type: "money", value: tier.price + step }, after: { type: "money", value: tier.price } },
    ];
    if (p.policies?.cancelHours) changes.push({ field: "policies.cancelHours", area: "rules", before: num(p.policies.cancelHours * 2, "hours"), after: num(p.policies.cancelHours, "hours") });
    add(26 * H + (h % 7) * H, lead, changes);
  }
  // 2. A rename made and taken back four minutes later (net zero), the day before.
  if (tier) {
    const alt = `${tier.name}s`.replace(/ss$/, "s");
    const t0 = 50 * H + (h % 5) * H;
    add(t0, lead, [{ field: "tier.name", area: "prices", subject: { kind: "tier", id: tier.id, name: tier.name }, before: text(tier.name), after: text(alt) }]);
    add(t0 - 4 * 60_000, lead, [{ field: "tier.name", area: "prices", subject: { kind: "tier", id: tier.id, name: alt }, before: text(alt), after: text(tier.name) }]);
  }
  // 3. Publishing (or taking off sale), ~4 days ago.
  const status = p.status === "archived" ? "inactive" : p.status;
  add(4 * D + (h % 9) * H, other, [{ field: "status", area: "status", before: { type: "status", value: status === "active" ? "inactive" : "active" }, after: { type: "status", value: status } }]);
  // 4. Copy and photos, ~9 days ago, by someone else.
  if (p.description) {
    add(9 * D + (h % 11) * H, other, [
      { field: "description", area: "details", before: { type: "longText", value: shorter(p.description) }, after: { type: "longText", value: p.description } },
      { field: "photos", area: "details", before: num(Math.max(0, (p.images?.length ?? 0) - 1)), after: num(p.images?.length ?? 0) },
    ]);
  }
  // 5. Creation.
  const tracked = now - created < TRACKING_FROM_DAYS * D;
  out.push({ id: `rev_seed_${p.id}_created`, productId: p.id, at: p.createdAt, actor: tracked ? pick(h + 2) : null, kind: "created", changes: [] });
  return out;
}

/* Seeded once per booking and then frozen: history is written backwards from
   the values the booking had when it was first looked at (or first edited). */
const seeded = new Map<ID, CatalogRevision[]>();
function seedOnce(p: Product): CatalogRevision[] {
  let s = seeded.get(p.id);
  if (!s) {
    s = seedFor(p);
    seeded.set(p.id, s);
  }
  return s;
}

// ── Read / revert ───────────────────────────────────────────────────────────

/** Newest first. */
export async function listCatalogHistory(product: Product): Promise<ApiResult<CatalogRevision[]>> {
  await delay();
  const live = recorded.filter((r) => r.productId === product.id);
  const all = [...live, ...seedOnce(product)].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return ok(structuredClone(all));
}

/** Fields `revertCatalogChanges` can put back. Added and removed tickets are
 *  not: bringing a ticket back is a decision about money already taken. */
export function canRevert(c: CatalogFieldChange): boolean {
  return c.field !== "tier.added" && c.field !== "tier.removed" && c.field !== "photos" && c.field !== "locations" && c.field !== "channels";
}

/** Puts the BEFORE values of these changes back with one save, filed as a
 *  revert of the moment they were made. */
export async function revertCatalogChanges(
  product: Product,
  changes: CatalogFieldChange[],
  madeAt: ISODateTime,
  update: (id: ID, patch: ProductPatch) => Promise<ApiResult<Product>>,
): Promise<ApiResult<Product>> {
  const patch: Record<string, unknown> = {};
  const policies = product.policies ? { ...product.policies } : undefined;
  const tiers = product.tiers.map((t) => ({ ...t }));
  let tiersTouched = false;
  for (const c of changes.filter(canRevert)) {
    const v = c.before;
    if (c.field.startsWith("tier.") && c.subject) {
      const t = tiers.find((x) => x.id === c.subject!.id);
      if (!t) continue;
      tiersTouched = true;
      if (c.field === "tier.name" && v?.type === "text") t.name = v.value;
      if (c.field === "tier.price" && v?.type === "money") t.price = v.value;
      if (c.field === "tier.onSale" && v?.type === "bool") t.active = v.value;
      continue;
    }
    if (c.field.startsWith("policies.") && policies) {
      const key = c.field.slice("policies.".length) as keyof typeof policies;
      (policies as Record<string, unknown>)[key] = v == null ? undefined : (v as { value: unknown }).value;
      patch.policies = policies;
      continue;
    }
    if (c.field === "payNow") patch.payNow = v?.type === "payNow" ? (v.value ?? undefined) : undefined;
    else if (c.field === "status" && v?.type === "status") patch.status = v.value;
    else if (c.field === "name" && v?.type === "text") patch.name = v.value;
    else if (c.field === "description") patch.description = v?.type === "longText" ? v.value : "";
    else if (c.field === "minAge") patch.minAge = v?.type === "number" ? v.value : undefined;
    else if (c.field === "maxPerOrder") patch.maxPerOrder = v?.type === "number" ? v.value : undefined;
  }
  if (tiersTouched) patch.tiers = tiers;
  if (Object.keys(patch).length === 0) return fail(notFoundError("Change"));
  pendingRevert = madeAt;
  try {
    return await update(product.id, patch as ProductPatch);
  } finally {
    pendingRevert = null;
  }
}
