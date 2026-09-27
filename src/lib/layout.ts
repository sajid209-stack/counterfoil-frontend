/**
 * The geometry and the vocabulary of a floor plan.
 *
 * Pure: no React, no store. The designer, the till's picker and any storefront
 * that draws a room all read their maths from here, so the plan an operator
 * draws and the plan a customer is offered cannot disagree about where anything
 * is. That is the same reason the receipt and the printed ticket share
 * `ReceiptParts` rather than each drawing a total.
 *
 * ── Units ──────────────────────────────────────────────────────────────────
 * `posX`/`posY`/`width`/`height` are in CANVAS UNITS, one unit being one seat
 * pitch. A plain rows × columns grid is the special case where they are the
 * integer row and column — which is why every layout drawn before the designer
 * existed still places correctly, with no migration. A renderer turns units
 * into pixels with a single scale it chooses to fit its own box.
 *
 * ── What is sellable ───────────────────────────────────────────────────────
 * `LayoutSeat` is a thing somebody can buy; `LayoutFixture` is scenery that
 * says where you are. A screen is not a seat with no category, which is why
 * they are two arrays rather than one with a flag.
 *
 * A TABLE is one sellable element whose `capacity` is its covers, not four
 * chairs around a fixture — because a restaurant takes a booking for table 7
 * and a theatre sells seat A12. Modelling the chairs separately would make
 * "what did they buy" ambiguous on the one screen that must not be.
 */
import type {
  LayoutElementKind,
  LayoutExperience,
  LayoutFixture,
  LayoutFixtureKind,
  LayoutSeat,
  SeatCategory,
  SeatShape,
} from "./api/types";

/* ── Labels ──────────────────────────────────────────────────────────────── */

/** 0→A … 25→Z, 26→AA … — enough for any real hall. */
export function rowLabel(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/* ── Geometry ────────────────────────────────────────────────────────────── */

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface Box {
  posX: number;
  posY: number;
  width?: number;
  height?: number;
}

const w = (b: Box) => b.width ?? 1;
const h = (b: Box) => b.height ?? 1;

/**
 * The bounding box of everything on the plan, in units, padded by half a unit
 * so nothing sits flush against the edge of its own frame.
 *
 * An empty plan still returns a usable box rather than a zero one: a canvas
 * that collapses to nothing is a canvas nobody can drop the first seat onto.
 */
export function planExtent(items: Box[], pad = 0.5): Extent {
  if (!items.length) return { minX: 0, minY: 0, maxX: 12, maxY: 8, width: 12, height: 8 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const it of items) {
    minX = Math.min(minX, it.posX);
    minY = Math.min(minY, it.posY);
    maxX = Math.max(maxX, it.posX + w(it));
    maxY = Math.max(maxY, it.posY + h(it));
  }
  minX -= pad;
  minY -= pad;
  maxX += pad;
  maxY += pad;
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** The px-per-unit that fits `extent` inside a box, never magnifying past `max`. */
export function fitScale(extent: Extent, boxW: number, boxH: number, max = 34): number {
  if (extent.width <= 0 || extent.height <= 0) return max;
  return Math.max(6, Math.min(max, boxW / extent.width, boxH / extent.height));
}

/** Snap to the nearest step. The designer's grain, and the only place it lives. */
export const snap = (v: number, step = 0.5) => Math.round(v / step) * step;

/**
 * Is the point inside the box? Rotation-aware: the point is rotated back about
 * the box's own centre before the test, so a table turned 30 degrees is picked
 * up where it looks rather than where its unrotated bounds are.
 */
export function hitBox(b: Box & { rotation?: number }, x: number, y: number): boolean {
  let px = x;
  let py = y;
  if (b.rotation) {
    const cx = b.posX + w(b) / 2;
    const cy = b.posY + h(b) / 2;
    const a = (-b.rotation * Math.PI) / 180;
    const dx = x - cx;
    const dy = y - cy;
    px = cx + dx * Math.cos(a) - dy * Math.sin(a);
    py = cy + dx * Math.sin(a) + dy * Math.cos(a);
  }
  return px >= b.posX && px <= b.posX + w(b) && py >= b.posY && py <= b.posY + h(b);
}

/** The topmost thing under a point — last in the array wins, as it is drawn last. */
export function hitTest<T extends Box & { rotation?: number }>(items: T[], x: number, y: number): T | null {
  for (let i = items.length - 1; i >= 0; i--) if (hitBox(items[i], x, y)) return items[i];
  return null;
}

/** Everything whose box intersects the marquee. */
export function boxesIn<T extends Box>(items: T[], a: { x: number; y: number }, b: { x: number; y: number }): T[] {
  const r = { posX: Math.min(a.x, b.x), posY: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
  return items.filter((it) => overlaps(it, r));
}

/** Does a box overlap another? Used to keep a dropped element off its neighbours. */
export function overlaps(a: Box, b: Box): boolean {
  return (
    a.posX < b.posX + w(b) && a.posX + w(a) > b.posX && a.posY < b.posY + h(b) && a.posY + h(a) > b.posY
  );
}

/* ── Element factories ───────────────────────────────────────────────────── */

let counter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export interface SeatInit {
  kind?: LayoutElementKind;
  name?: string;
  posX: number;
  posY: number;
  width?: number;
  height?: number;
  shape?: SeatShape;
  rotation?: number;
  capacity?: number;
  seatRow?: string;
  seatNumber?: number;
  categoryUid?: string | null;
  assignOrder?: number;
}

export function makeSeat(init: SeatInit): LayoutSeat {
  const kind = init.kind ?? "seat";
  return {
    id: uid(kind === "seat" ? "seat" : kind),
    name: init.name ?? "",
    kind,
    posX: init.posX,
    posY: init.posY,
    seatRow: init.seatRow ?? "",
    seatNumber: init.seatNumber ?? 1,
    seatCategoryId: init.categoryUid ?? null,
    isAvailable: true,
    capacity: init.capacity ?? 1,
    shape: init.shape ?? (kind === "table" ? "circle" : "square"),
    width: init.width ?? 1,
    height: init.height ?? 1,
    rotation: init.rotation ?? 0,
    assignOrder: init.assignOrder ?? 0,
  };
}

export function makeFixture(kind: LayoutFixtureKind, posX: number, posY: number, over?: Partial<LayoutFixture>): LayoutFixture {
  const d = FIXTURE_DEFAULTS[kind];
  return {
    id: uid(kind),
    kind,
    label: d.label,
    posX,
    posY,
    width: d.width,
    height: d.height,
    rotation: 0,
    ...over,
  };
}

const FIXTURE_DEFAULTS: Record<LayoutFixtureKind, { label: string; width: number; height: number }> = {
  screen: { label: "SCREEN", width: 8, height: 0.75 },
  stage: { label: "STAGE", width: 8, height: 2 },
  door: { label: "Entrance", width: 1.5, height: 0.5 },
  bar: { label: "Bar", width: 5, height: 1.25 },
  wall: { label: "", width: 6, height: 0.25 },
  text: { label: "Label", width: 3, height: 0.75 },
};

/* ── Bulk generators ─────────────────────────────────────────────────────── */

export interface RowInit {
  row: string; // "A"
  count: number;
  posX: number;
  posY: number;
  gap?: number; // pitch between seats, in units
  /** How far the middle of the row bows towards the screen, in units. 0 = straight. */
  curve?: number;
  categoryUid?: string | null;
  startNumber?: number;
  assignFrom?: number;
}

/**
 * One row of seats. `curve` bows it, which is what makes a theatre read as a
 * theatre — every seat on a straight row faces the same way, and in a real
 * house they do not.
 */
export function seatRow(init: RowInit): LayoutSeat[] {
  const { row, count, posX, posY, gap = 1, curve = 0, categoryUid = null, startNumber = 1 } = init;
  const out: LayoutSeat[] = [];
  const mid = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    // a parabola through the row: 0 at the ends, `curve` at the middle
    const t = mid === 0 ? 0 : (i - mid) / mid;
    const dy = curve * (1 - t * t);
    out.push(
      makeSeat({
        name: `${row}${startNumber + i}`,
        seatRow: row,
        seatNumber: startNumber + i,
        posX: posX + i * gap,
        posY: posY - dy,
        categoryUid,
        assignOrder: (init.assignFrom ?? 0) + i,
      }),
    );
  }
  return out;
}

export interface BlockInit {
  rows: number;
  perRow: number;
  posX: number;
  posY: number;
  gap?: number;
  rowGap?: number;
  curve?: number;
  categoryUid?: string | null;
  firstRow?: number; // 0 = start labelling at A
}

/** A block of rows, labelled A, B, C… downwards. */
export function seatBlock(init: BlockInit): LayoutSeat[] {
  const { rows, perRow, posX, posY, gap = 1, rowGap = 1, curve = 0, categoryUid = null, firstRow = 0 } = init;
  const out: LayoutSeat[] = [];
  for (let r = 0; r < rows; r++) {
    out.push(
      ...seatRow({
        row: rowLabel(firstRow + r),
        count: perRow,
        posX,
        posY: posY + r * rowGap,
        gap,
        curve,
        categoryUid,
        assignFrom: out.length,
      }),
    );
  }
  return out;
}

/** A plain rows × columns grid — what `generateSeats` has always produced. */
export const plainGrid = (rows: number, perRow: number) => seatBlock({ rows, perRow, posX: 0, posY: 0 });

export interface TableInit {
  name: string;
  covers: number;
  posX: number;
  posY: number;
  shape?: SeatShape;
  categoryUid?: string | null;
}

/** One table. Its covers are its capacity; the size follows the covers so a
 *  party of eight is visibly a bigger table than a party of two. */
export function makeTable(init: TableInit): LayoutSeat {
  const { covers, shape = covers > 4 ? "rounded" : "circle" } = init;
  const side = covers <= 2 ? 1.25 : covers <= 4 ? 1.75 : covers <= 6 ? 2.25 : 2.75;
  return makeSeat({
    kind: "table",
    name: init.name,
    posX: init.posX,
    posY: init.posY,
    width: shape === "rounded" ? side * 1.4 : side,
    height: side,
    shape,
    capacity: covers,
    categoryUid: init.categoryUid ?? null,
    seatRow: "",
    seatNumber: covers,
  });
}

/** A standing area. One element, sold `capacity` times. */
export function makeGa(name: string, posX: number, posY: number, capacity: number, categoryUid: string | null = null): LayoutSeat {
  return makeSeat({
    kind: "ga",
    name,
    posX,
    posY,
    width: 5,
    height: 3,
    shape: "rounded",
    capacity,
    categoryUid,
  });
}

/* ── The palette, per experience ─────────────────────────────────────────── */

export type PaletteTool =
  | { id: string; kind: "seat" }
  | { id: string; kind: "row"; count: number; curve?: number }
  | { id: string; kind: "block"; rows: number; perRow: number; curve?: number }
  | { id: string; kind: "table"; covers: number; shape: SeatShape }
  | { id: string; kind: "ga"; capacity: number }
  | { id: string; kind: "fixture"; fixture: LayoutFixtureKind };

/**
 * What an operator can drop, decided by the kind of room.
 *
 * A cinema is not offered a bar and a restaurant is not offered a screen: a
 * palette that shows every tool for every venue makes the operator do the
 * filtering, which is the job the "what kind of space is this?" question was
 * asked to do.
 */
export const PALETTES: Record<LayoutExperience, PaletteTool[]> = {
  cinema: [
    { id: "seat", kind: "seat" },
    { id: "row10", kind: "row", count: 10 },
    { id: "block", kind: "block", rows: 5, perRow: 10 },
    { id: "screen", kind: "fixture", fixture: "screen" },
    { id: "door", kind: "fixture", fixture: "door" },
    { id: "text", kind: "fixture", fixture: "text" },
  ],
  theatre: [
    { id: "seat", kind: "seat" },
    { id: "rowCurved", kind: "row", count: 12, curve: 1 },
    { id: "blockCurved", kind: "block", rows: 6, perRow: 12, curve: 1 },
    { id: "stage", kind: "fixture", fixture: "stage" },
    { id: "ga", kind: "ga", capacity: 40 },
    { id: "door", kind: "fixture", fixture: "door" },
    { id: "text", kind: "fixture", fixture: "text" },
  ],
  restaurant: [
    { id: "table2", kind: "table", covers: 2, shape: "circle" },
    { id: "table4", kind: "table", covers: 4, shape: "square" },
    { id: "table6", kind: "table", covers: 6, shape: "rounded" },
    { id: "booth", kind: "table", covers: 4, shape: "rounded" },
    { id: "bar", kind: "fixture", fixture: "bar" },
    { id: "wall", kind: "fixture", fixture: "wall" },
    { id: "door", kind: "fixture", fixture: "door" },
    { id: "text", kind: "fixture", fixture: "text" },
  ],
  stadium: [
    { id: "block", kind: "block", rows: 8, perRow: 14 },
    { id: "ga", kind: "ga", capacity: 200 },
    { id: "seat", kind: "seat" },
    { id: "text", kind: "fixture", fixture: "text" },
    { id: "door", kind: "fixture", fixture: "door" },
  ],
  general: [
    { id: "seat", kind: "seat" },
    { id: "row10", kind: "row", count: 10 },
    { id: "block", kind: "block", rows: 5, perRow: 10 },
    { id: "table4", kind: "table", covers: 4, shape: "square" },
    { id: "ga", kind: "ga", capacity: 50 },
    { id: "stage", kind: "fixture", fixture: "stage" },
    { id: "wall", kind: "fixture", fixture: "wall" },
    { id: "door", kind: "fixture", fixture: "door" },
    { id: "text", kind: "fixture", fixture: "text" },
  ],
};

/* ── Starting points ─────────────────────────────────────────────────────── */

export interface Plan {
  seats: LayoutSeat[];
  fixtures: LayoutFixture[];
  categories: SeatCategory[];
}

const cat = (uid: string, name: string, color: string, price: number, ga = false): SeatCategory => ({
  uid,
  name,
  color,
  price,
  pricingMode: "fixed",
  isGeneralAdmission: ga,
});

/**
 * A room to start from, per experience.
 *
 * An empty canvas is the worst first screen a designer can show: the operator
 * has to work out what a plan is made of before they can begin. Each template
 * is a real small room they can rename, stretch and rearrange — which is how
 * every floor-plan tool worth using opens.
 */
export const TEMPLATES: Record<LayoutExperience, () => Plan> = {
  cinema: () => {
    const stalls = cat("cat_stalls", "Stalls", "#2563EB", 40000);
    const premium = cat("cat_premium", "Premium", "#F94A00", 60000);
    return {
      categories: [stalls, premium],
      fixtures: [makeFixture("screen", 1, 0, { width: 10 })],
      seats: [
        ...seatBlock({ rows: 4, perRow: 10, posX: 1, posY: 1.5, categoryUid: stalls.uid }),
        ...seatBlock({ rows: 2, perRow: 10, posX: 1, posY: 6, categoryUid: premium.uid, firstRow: 4 }),
      ],
    };
  },
  theatre: () => {
    const stalls = cat("cat_stalls", "Stalls", "#2563EB", 50000);
    const circle = cat("cat_circle", "Dress circle", "#7C3AED", 75000);
    return {
      categories: [stalls, circle],
      fixtures: [makeFixture("stage", 2, 0, { width: 10 })],
      seats: [
        ...seatBlock({ rows: 5, perRow: 14, posX: 0, posY: 3, curve: 1, categoryUid: stalls.uid }),
        ...seatBlock({ rows: 3, perRow: 14, posX: 0, posY: 9.5, curve: 0.8, categoryUid: circle.uid, firstRow: 5 }),
      ],
    };
  },
  restaurant: () => {
    const main = cat("cat_main", "Dining room", "#16A34A", 0);
    const window = cat("cat_window", "Window", "#F94A00", 50000);
    const t: LayoutSeat[] = [];
    // two rows of small tables against the window, larger ones inside
    for (let i = 0; i < 4; i++) t.push(makeTable({ name: `W${i + 1}`, covers: 2, posX: 1 + i * 2.5, posY: 1, categoryUid: window.uid }));
    for (let i = 0; i < 3; i++) t.push(makeTable({ name: `T${i + 1}`, covers: 4, posX: 1.5 + i * 3, posY: 4, categoryUid: main.uid }));
    t.push(makeTable({ name: "T4", covers: 6, posX: 2, posY: 7, categoryUid: main.uid }));
    t.push(makeTable({ name: "T5", covers: 6, posX: 7, posY: 7, categoryUid: main.uid }));
    return {
      categories: [window, main],
      fixtures: [makeFixture("bar", 1, 10, { width: 6 }), makeFixture("door", 10, 10.4)],
      seats: t,
    };
  },
  stadium: () => {
    const stand = cat("cat_stand", "Main stand", "#2563EB", 30000);
    const terrace = cat("cat_terrace", "Terrace", "#16A34A", 15000, true);
    return {
      categories: [stand, terrace],
      fixtures: [makeFixture("text", 5, 6, { label: "PITCH", width: 6, height: 2 })],
      seats: [
        ...seatBlock({ rows: 5, perRow: 16, posX: 0, posY: 0, categoryUid: stand.uid }),
        makeGa("Terrace", 4, 9, 200, terrace.uid),
      ],
    };
  },
  general: () => {
    const all = cat("cat_all", "Admission", "#F94A00", 25000);
    return {
      categories: [all],
      fixtures: [makeFixture("stage", 2, 0, { width: 8 })],
      seats: seatBlock({ rows: 5, perRow: 12, posX: 0, posY: 2.5, categoryUid: all.uid }),
    };
  },
};

/** Every experience, in the order the chooser offers them. */
export const EXPERIENCES: LayoutExperience[] = ["cinema", "theatre", "restaurant", "stadium", "general"];

/* ── Counting ────────────────────────────────────────────────────────────── */

/**
 * How many people the plan can sell to — the sum of every categorised
 * element's capacity, NOT the number of elements. One table of six is six
 * covers and one GA block is its whole capacity; counting elements would tell
 * a restaurant it seats nine when it seats thirty-four.
 */
export function planCapacity(seats: LayoutSeat[]): number {
  return seats.filter((s) => s.seatCategoryId).reduce((n, s) => n + (s.capacity || 1), 0);
}

/** How many things are for sale, which is what a seat picker draws. */
export const sellableCount = (seats: LayoutSeat[]) => seats.filter((s) => s.seatCategoryId).length;
