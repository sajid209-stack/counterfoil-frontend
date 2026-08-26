import { createResource, fail, ok, notFoundError, validationError } from "./client";
import { peekProducts } from "./products";
import type {
  ApiResult,
  AvailableSeat,
  LayoutSeat,
  ListParams,
  ListResponse,
  SeatCategory,
  SeatLayout,
  SeatLayoutInput,
} from "./types";

const resource = createResource<SeatLayout>("seatLayouts", "Seat layout", {
  search: (l, q) => l.name.toLowerCase().includes(q),
  sort: { name: (a, b) => a.name.localeCompare(b.name) },
  defaultSort: "name",
});

const rowLabel = (i: number) => {
  // 0→A … 25→Z, 26→AA … (enough for any real hall)
  let s = "", n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
};

/** Generate a plain rows × seatsPerRow grid of seats (all uncategorised). */
export function generateSeats(rows: number, seatsPerRow: number): LayoutSeat[] {
  const seats: LayoutSeat[] = [];
  let order = 0;
  for (let r = 0; r < rows; r++) {
    const label = rowLabel(r);
    for (let c = 0; c < seatsPerRow; c++) {
      seats.push({
        id: `seat_${label}${c + 1}`,
        name: `${label}${c + 1}`,
        posX: c, posY: r,
        seatRow: label, seatNumber: c + 1,
        seatCategoryId: null, isAvailable: true, capacity: 1,
        shape: "square", width: 1, height: 1, rotation: 0,
        assignOrder: order++,
      });
    }
  }
  return seats;
}

export const listSeatLayouts = (params?: ListParams): Promise<ApiResult<ListResponse<SeatLayout>>> =>
  resource.list(params);
export const getSeatLayout = (id: string): Promise<ApiResult<SeatLayout>> => resource.get(id);
export const peekSeatLayouts = (): SeatLayout[] => resource.peek();

export function createSeatLayout(input: SeatLayoutInput): Promise<ApiResult<SeatLayout>> {
  if (!input.name?.trim()) return Promise.resolve(fail(validationError({ name: "Give the layout a name." })));
  const seats = generateSeats(input.rows, input.seatsPerRow);
  return resource.create({
    ...input,
    seatCount: seats.length,
    categories: [],
    seats,
  } as Omit<SeatLayout, "id" | "createdAt" | "updatedAt">);
}

export function updateSeatLayout(id: string, patch: Partial<SeatLayout>): Promise<ApiResult<SeatLayout>> {
  return resource.update(id, patch);
}

/** Replace the plan (seats + categories) — mirrors catalog's layout plan save. */
export function saveLayoutPlan(id: string, seats: LayoutSeat[], categories: SeatCategory[]): Promise<ApiResult<SeatLayout>> {
  return resource.update(id, { seats, categories, seatCount: seats.filter((s) => s.seatCategoryId).length });
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
      };
    });
  return ok(seats);
}
