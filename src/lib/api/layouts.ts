import { createResource, fail, ok, notFoundError, validationError } from "./client";
import { peekProducts } from "./products";
import { plainGrid, planCapacity, rowLabel, sellableCount, TEMPLATES } from "../layout";
import type {
  ApiResult,
  AvailableSeat,
  LayoutExperience,
  LayoutFixture,
  LayoutSeat,
  ListParams,
  ListResponse,
  SeatCategory,
  SeatLayout,
  SeatLayoutInput,
  SeatMap,
} from "./types";

const resource = createResource<SeatLayout>("seatLayouts", "Seat layout", {
  search: (l, q) => l.name.toLowerCase().includes(q),
  sort: { name: (a, b) => a.name.localeCompare(b.name) },
  defaultSort: "name",
});

/** Generate a plain rows × seatsPerRow grid of seats (all uncategorised).
 *  The geometry lives in `lib/layout`, which the designer and the till's
 *  picker read too, so there is one idea of where a seat sits. */
export const generateSeats = (rows: number, seatsPerRow: number): LayoutSeat[] => plainGrid(rows, seatsPerRow);
export { rowLabel };

export const listSeatLayouts = (params?: ListParams): Promise<ApiResult<ListResponse<SeatLayout>>> =>
  resource.list(params);
export const getSeatLayout = (id: string): Promise<ApiResult<SeatLayout>> => resource.get(id);
export const peekSeatLayouts = (): SeatLayout[] => resource.peek();

/**
 * A new plan.
 *
 * `experience` decides what it starts as: an empty canvas is the worst first
 * screen a designer can show, because the operator has to work out what a plan
 * is made of before they can begin. So a room comes with a small real one they
 * can rename and rearrange — unless `blank` is asked for, which is the escape
 * for somebody who knows exactly what they are drawing.
 */
export function createSeatLayout(
  input: SeatLayoutInput & { experience?: LayoutExperience; blank?: boolean },
): Promise<ApiResult<SeatLayout>> {
  if (!input.name?.trim()) return Promise.resolve(fail(validationError({ name: "Give the layout a name." })));
  const { experience = "general", blank = false, ...rest } = input;
  const plan = blank
    ? { seats: generateSeats(rest.rows, rest.seatsPerRow), fixtures: [], categories: [] }
    : TEMPLATES[experience]();
  return resource.create({
    ...rest,
    experience,
    seatCount: planCapacity(plan.seats),
    categories: plan.categories,
    seats: plan.seats,
    fixtures: plan.fixtures,
  } as Omit<SeatLayout, "id" | "createdAt" | "updatedAt">);
}

export function updateSeatLayout(id: string, patch: Partial<SeatLayout>): Promise<ApiResult<SeatLayout>> {
  return resource.update(id, patch);
}

/**
 * Replace the plan — mirrors catalog's layout plan save.
 *
 * `seatCount` is how many PEOPLE the room can sell to, not how many elements
 * are on it: one table of six is six covers. Counting elements would tell a
 * restaurant with nine tables that it seats nine.
 */
export function saveLayoutPlan(
  id: string,
  seats: LayoutSeat[],
  categories: SeatCategory[],
  fixtures: LayoutFixture[] = [],
): Promise<ApiResult<SeatLayout>> {
  return resource.update(id, { seats, categories, fixtures, seatCount: planCapacity(seats) });
}

/** The seats offered for a product's layout, as the POS/storefront picker reads
 *  them (catalog available-seats). Sold/blocked seats come back `available:false`. */
export async function availableSeats(productId: string): Promise<ApiResult<AvailableSeat[]>> {
  const product = peekProducts().find((p) => p.id === productId);
  const layoutId = product?.layoutId;
  if (!layoutId) return ok<AvailableSeat[]>([]);
  const layout = resource.peek().find((l) => l.id === layoutId);
  if (!layout) return fail<AvailableSeat[]>(notFoundError("Seat layout"));
  const cat = (uid: string | null) => layout.categories.find((c) => c.uid === uid);
  const seats = layout.seats
    .filter((s) => s.seatCategoryId) // only categorised seats are sellable
    .map<AvailableSeat>((s) => {
      const c = cat(s.seatCategoryId);
      return {
        label: s.name,
        available: s.isAvailable,
        section: c?.name ?? "",
        categoryUid: s.seatCategoryId!,
        categoryName: c?.name ?? "",
        color: c?.color ?? "#8a8985",
        price: c?.price ?? 0,
        posX: s.posX,
        posY: s.posY,
        /* The shape travels with the seat, so the till draws the room the
           operator designed instead of a grid of identical squares. */
        kind: s.kind ?? "seat",
        shape: s.shape,
        width: s.width,
        height: s.height,
        rotation: s.rotation,
        capacity: s.capacity,
      };
    });
  return ok(seats);
}

/**
 * The whole room a buyer's screen draws: what is for sale, and the scenery.
 *
 * The till used to print its own "SCREEN" banner above a grid — which is a
 * guess, and wrong the moment the room is a restaurant. The screen is now
 * wherever the operator put it, and a dining room has a bar and a door instead.
 */
export async function seatMap(productId: string): Promise<ApiResult<SeatMap>> {
  const res = await availableSeats(productId);
  if (!res.ok) return fail<SeatMap>(res.error);
  const product = peekProducts().find((p) => p.id === productId);
  const layout = product?.layoutId ? resource.peek().find((l) => l.id === product.layoutId) : undefined;
  return ok<SeatMap>({
    seats: res.data,
    fixtures: layout?.fixtures ?? [],
    experience: layout?.experience ?? "general",
  });
}

/** What the plan would sell to, for a screen that states it. */
export const layoutCapacity = (layout: SeatLayout) => planCapacity(layout.seats);
export const layoutSellable = (layout: SeatLayout) => sellableCount(layout.seats);
