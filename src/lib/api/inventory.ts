/* inventory.v1 — the countable things a venue hands over.

   Two rules shape this module, and both are already this codebase's own:

   1. **The count is never stored.** On hand is an append-only ledger of
      movements, replayed — the way the loyalty balance works. A stored total
      and a ledger disagree exactly once, and then nobody can tell which is
      right. Every screen asks `levelOf`, so every screen gets the same answer.

   2. **A movement always says why.** `reason` is required for a correction;
      a sale carries its order instead, which is a better reason than any
      sentence. An unexplained stock change is indistinguishable from a bug
      six weeks later — the rule holds and booking locks already follow.

   3. **One count, not three.** Shopify splits stock into on hand, committed
      and available because an order there is placed now and picked later by a
      separate event. Counterfoil has no hand-over event, so a sale takes the
      stock the moment it is rung up — which makes "committed" either a second
      subtraction against the same sale or a number that never settles. One
      honest figure beats three where two are fabricated. `levelOf` is
      therefore venue-scoped rather than state-split: the question a counter
      asks is "how many are HERE", and that is the one this answers. */
import { createResource, fail, notFoundError, ok, validationError } from "./client";
import { demoNow } from "@/lib/schedule";
import type { EventRecord } from "./events";
import type {
  ApiResult,
  Product,
  ID,
  InventoryItem,
  InventoryItemInput,
  InventoryItemView,
  InventoryKind,
  ListParams,
  ListResponse,
  StockLevel,
  StockMovement,
  StockMovementInput,
} from "./types";

/* Read-only handles on the collections this module has to ask about.
   Deliberately NOT imports of `products.ts` / `orders.ts`: checkout writes a
   stock movement when a sale completes, so that module imports this one, and
   two modules importing each other is a cycle that breaks differently in the
   bundler and in a test runner. A handle is just a view on the store. */
const productsStore = createResource<Product>("products", "Booking");
const eventsStore = createResource<EventRecord>("events", "Event");

const items = createResource<InventoryItem>("inventoryItems", "Inventory item", {
  search: (i, q) =>
    i.name.toLowerCase().includes(q) ||
    (i.sku ?? "").toLowerCase().includes(q) ||
    i.unit.toLowerCase().includes(q),
  sort: {
    name: (a, b) => a.name.localeCompare(b.name),
    createdAt: (a, b) => a.createdAt.localeCompare(b.createdAt),
  },
  defaultSort: "name",
});

const movements = createResource<StockMovement>("stockMovements", "Stock movement", {
  sort: { at: (a, b) => a.at.localeCompare(b.at) },
  defaultSort: "at",
});

export const peekInventory = (): InventoryItem[] => items.peek();
export const peekStockMovements = (): StockMovement[] => movements.peek();

/** An item by id, without a round trip — the till and the catalogue both need
 *  this while rendering a row. */
export const inventoryItem = (id: ID): InventoryItem | undefined =>
  items.peek().find((i) => i.id === id);

// ── the ledger, replayed ────────────────────────────────────────────────────

/** What one item's ledger adds up to, at one location or across all of them. */
export function levelOf(itemId: ID, locationId?: ID): StockLevel {
  const onHand = movements
    .peek()
    .filter((m) => m.itemId === itemId && (!locationId || m.locationId === locationId))
    .reduce((n, m) => n + m.quantity, 0);
  return { itemId, locationId: locationId ?? "", onHand };
}

/** Every location's figures for one item — the item page's Stock tab. */
export function levelsOf(itemId: ID): StockLevel[] {
  const item = inventoryItem(itemId);
  if (!item) return [];
  return item.locationIds.map((locationId) => levelOf(itemId, locationId));
}

/** The ledger for one item, newest first. */
export function movementsOf(itemId: ID, locationId?: ID): StockMovement[] {
  return movements
    .peek()
    .filter((m) => m.itemId === itemId && (!locationId || m.locationId === locationId))
    /* Parsed, not compared as strings: the seed writes +06:00 and anything
       written here is UTC, and `localeCompare` on mixed offsets orders the
       same day wrongly — the trap this codebase already hit on the activity
       feed. */
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ── what sells it ───────────────────────────────────────────────────────────

/**
 * Where an item is offered, derived from the catalogue.
 *
 * The link lives on the thing that sells it — a booking's extras, an event's
 * extras — and never on the item. An item holding its own list of what offers
 * it would go stale the moment a booking stopped offering it, and nothing
 * would notice; derived, the two cannot disagree.
 */
export function linksTo(itemId: ID): { kind: "booking" | "event"; id: ID; name: string; addOnId: ID }[] {
  const out: { kind: "booking" | "event"; id: ID; name: string; addOnId: ID }[] = [];
  for (const p of productsStore.peek()) {
    for (const a of p.addOns ?? []) {
      if (a.itemId === itemId) out.push({ kind: "booking", id: p.id, name: p.name, addOnId: a.id });
    }
  }
  for (const e of eventsStore.peek()) {
    for (const a of e.extras ?? []) {
      if (a.itemId === itemId) out.push({ kind: "event", id: e.id, name: e.title, addOnId: a.id });
    }
  }
  return out;
}

/** The item behind an extra, when there is one.
 *
 *  Takes the add-on's own id OR the `addon_<id>` product id an order line
 *  carries, because both callers exist and neither should have to know how
 *  the other spells it. */
export const itemForAddOn = (ref: ID): InventoryItem | undefined => {
  /* Sold on its own: the line IS the item, so there is no add-on to look up.
     Checked first because it is the cheap answer. */
  if (ref.startsWith(INVENTORY_LINE_PREFIX)) {
    const direct = inventoryItem(ref.slice(INVENTORY_LINE_PREFIX.length));
    if (direct) return direct;
  }
  const addOnId = ref.startsWith("addon_") ? ref.slice("addon_".length) : ref;
  for (const p of productsStore.peek()) {
    const a = (p.addOns ?? []).find((x: { id: ID }) => x.id === addOnId);
    if (a?.itemId) return inventoryItem(a.itemId);
  }
  for (const e of eventsStore.peek()) {
    const a = (e.extras ?? []).find((x: { id: ID }) => x.id === addOnId);
    if (a?.itemId) return inventoryItem(a.itemId);
  }
  return undefined;
};

// ── the view every screen reads ─────────────────────────────────────────────

/** The record plus its figures and what sells it, at one location or across
 *  all of them. */
export function inventoryView(item: InventoryItem, locationId?: ID): InventoryItemView {
  const { onHand } = levelOf(item.id, locationId);
  const soldWith = linksTo(item.id).map(({ kind, id, name }) => ({ kind, id, name }));
  return {
    ...item,
    onHand,
    value: Math.max(0, onHand) * (item.cost ?? 0),
    outOfStock: item.tracked && onHand <= 0,
    low: item.tracked && onHand > 0 && onHand <= item.lowAt,
    soldWith,
  };
}

export async function listInventory(
  params?: ListParams & { locationId?: ID },
): Promise<ApiResult<ListResponse<InventoryItemView>>> {
  const res = await items.list(params);
  if (!res.ok) return res as ApiResult<ListResponse<InventoryItemView>>;
  return ok({ ...res.data, data: res.data.data.map((i) => inventoryView(i, params?.locationId)) });
}

export async function getInventoryItem(id: ID, locationId?: ID): Promise<ApiResult<InventoryItemView>> {
  const row = inventoryItem(id);
  if (!row) return fail(notFoundError("Inventory item"));
  return ok(inventoryView(row, locationId));
}

// ── writing ─────────────────────────────────────────────────────────────────

function validate(input: Partial<InventoryItemInput>): Record<string, string> {
  const e: Record<string, string> = {};
  if (input.name !== undefined && !input.name.trim()) e.name = "Give it a name.";
  if (input.unit !== undefined && !input.unit.trim()) e.unit = "Say what one of it is called — each, pair, bottle.";
  if (input.price !== undefined && input.price < 0) e.price = "A price cannot be less than nothing.";
  if (input.cost !== undefined && (input.cost ?? 0) < 0) e.cost = "A cost cannot be less than nothing.";
  if (input.lowAt !== undefined && input.lowAt < 0) e.lowAt = "Enter 0 to never call it low.";
  if (input.locationIds !== undefined && input.locationIds.length === 0) {
    e.locationIds = "Choose where it is kept — an item kept nowhere cannot be sold.";
  }
  return e;
}

export async function createInventoryItem(input: InventoryItemInput): Promise<ApiResult<InventoryItem>> {
  const errors = validate(input);
  if (Object.keys(errors).length) return fail(validationError(errors));
  return items.create(input);
}

export async function updateInventoryItem(
  id: ID,
  patch: Partial<InventoryItemInput>,
): Promise<ApiResult<InventoryItem>> {
  const errors = validate(patch);
  if (Object.keys(errors).length) return fail(validationError(errors));
  return items.update(id, patch);
}

export const archiveInventoryItem = (id: ID) => items.update(id, { status: "archived" });
export const restoreInventoryItem = (id: ID) => items.update(id, { status: "active" });

/**
 * Move the count, with the reason attached.
 *
 * `quantity` is signed and means what it says: +12 received, −1 sold, and for
 * a stocktake the DIFFERENCE it corrects rather than the number counted —
 * `stocktakeTo` works that out, because "I counted 9" is what an operator
 * knows and "adjust by −3" is what the ledger needs.
 */
export async function recordMovement(input: StockMovementInput): Promise<ApiResult<StockMovement>> {
  const item = inventoryItem(input.itemId);
  if (!item) return fail(notFoundError("Inventory item"));
  const errors: Record<string, string> = {};
  if (input.quantity === 0) errors.quantity = "Enter how many.";
  /* A removal bigger than the shelf is almost always a typo for a stocktake.
     It is refused rather than allowed to drive the count negative — a
     negative on hand is not a number anybody can act on. */
  if (input.kind !== "received" && input.kind !== "stocktake" && input.kind !== "returned") {
    const here = levelOf(input.itemId, input.locationId).onHand;
    if (input.quantity < 0 && Math.abs(input.quantity) > here) {
      errors.quantity = `The ledger says ${here} here. Count the shelf instead if that is wrong.`;
    }
  }
  /* A correction has to explain itself; a sale is explained by its order. */
  if (!input.orderId && !input.reason?.trim() && input.kind !== "sold") {
    errors.reason = "Say why the count changed.";
  }
  if (!item.locationIds.includes(input.locationId)) {
    errors.locationId = "This item is not kept at that venue.";
  }
  if (Object.keys(errors).length) return fail(validationError(errors));
  /* The DEMO clock, like every other seeded record: stamping the wall clock
     put a sale made "today" two months ahead of the ledger it joined, and the
     offset differed from the seed's, which is what breaks a string sort. */
  return movements.create({ ...input, at: demoNow().toISOString() });
}

/**
 * A hire that came back.
 *
 * The one verb a returnable item cannot do without: hire shoes, audio guides
 * and bib sets go out and come in all day, and without this their count only
 * ever falls — by the evening the till refuses to hire shoes while nineteen
 * pairs sit in the bin behind the counter. No typed reason is asked for: the
 * loan is the reason, and demanding a sentence per return is how a desk stops
 * recording them.
 */
export async function recordReturn(
  itemId: ID,
  locationId: ID,
  quantity: number,
  by: string,
): Promise<ApiResult<StockMovement>> {
  const item = inventoryItem(itemId);
  if (!item) return fail(notFoundError("Inventory item"));
  if (!item.returnable) {
    return fail(validationError({ quantity: `${item.name} is not something that comes back.` }));
  }
  return recordMovement({ itemId, locationId, kind: "returned", quantity: Math.abs(quantity), by, reason: "Came back" });
}

/** How many are out on loan: what has gone, less what has come back. Only
 *  meaningful for a returnable — for anything else "sold" means gone. */
export function outOnLoan(itemId: ID, locationId?: ID): number {
  const item = inventoryItem(itemId);
  if (!item?.returnable) return 0;
  const mine = movements.peek().filter((m) => m.itemId === itemId && (!locationId || m.locationId === locationId));
  const out = mine.filter((m) => m.kind === "sold").reduce((n, m) => n + Math.abs(m.quantity), 0);
  const back = mine.filter((m) => m.kind === "returned").reduce((n, m) => n + m.quantity, 0);
  return Math.max(0, out - back);
}

/** "I counted nine" → the movement that makes the ledger say nine. */
export async function stocktakeTo(
  itemId: ID,
  locationId: ID,
  counted: number,
  by: string,
  reason: string,
): Promise<ApiResult<StockMovement>> {
  const { onHand } = levelOf(itemId, locationId);
  const diff = counted - onHand;
  if (diff === 0) {
    return fail(validationError({ quantity: "That is what the count already says." }));
  }
  return recordMovement({ itemId, locationId, kind: "stocktake", quantity: diff, reason, by });
}

/**
 * What a sale takes off the shelf.
 *
 * Called after checkout succeeds, never before: stock moved for a sale that
 * then failed is stock nobody sold. Lines that are not inventory are ignored,
 * so the till can hand over every line it made without filtering first.
 */
export async function recordSale(
  orderId: ID,
  locationId: ID,
  lines: { productId: ID; quantity: number }[],
  by: string,
): Promise<{ moved: number; refused: { name: string; reason: string }[] }> {
  let moved = 0;
  /* What could NOT come off the shelf, and why. A swallowed ledger write is
     the one thing a ledger must never do: the sale charged for a bib set, the
     count did not move, and nothing anywhere said so. The caller says it. */
  const refused: { name: string; reason: string }[] = [];
  for (const line of lines) {
    const item = itemForAddOn(line.productId);
    if (!item || !item.tracked) continue;
    const res = await recordMovement({
      itemId: item.id,
      locationId,
      kind: "sold",
      quantity: -Math.abs(line.quantity),
      orderId,
      by,
    });
    if (res.ok) moved += 1;
    else refused.push({ name: item.name, reason: res.error.fieldErrors?.locationId ?? res.error.message });
  }
  return { moved, refused };
}

/**
 * What the till may put on its wall, at one venue.
 *
 * Kept here rather than filtered in the till, so all three tills ask one
 * question and get one answer — the same reason `tillMethods` decides the
 * payment buttons.
 */
export function counterItems(locationId?: ID): InventoryItemView[] {
  return items
    .peek()
    .filter(
      (i) =>
        i.status === "active" &&
        i.atCounter &&
        (!locationId || i.locationIds.includes(locationId)),
    )
    .map((i) => inventoryView(i, locationId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The prefix an inventory line carries on an order, so every surface that
 *  reads a line spells it the same way. */
export const INVENTORY_LINE_PREFIX = "inv_";
export const inventoryLineId = (itemId: ID) => `${INVENTORY_LINE_PREFIX}${itemId}`;

/** Items that need somebody to do something, newest problem first. */
export function inventoryAttention(locationId?: ID): InventoryItemView[] {
  return items
    .peek()
    .filter((i) => i.status === "active" && i.tracked)
    .map((i) => inventoryView(i, locationId))
    .filter((v) => v.outOfStock || v.low)
    .sort((a, b) => Number(b.outOfStock) - Number(a.outOfStock) || a.onHand - b.onHand);
}

/** Every kind, for a picker. Declared here so one list serves the form, the
 *  filter and the labels. */
export const INVENTORY_KINDS: InventoryKind[] = ["merch", "food", "equipment", "service"];
