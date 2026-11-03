import { adoptPublished, currentSavedScope, getOperatorState, isCreatedInThisBrowser, onCatalogueWrite, type PublishedSnapshot } from "./client";
import { peekProducts, productBySlug, slugOf } from "./products";
import { peekResources } from "./resources";
import { peekSeatLayouts } from "./layouts";
import { peekStaff } from "./staff";
import { getItemPage } from "./storefront";
import type { Product } from "./types";

/* Putting an item online.

   What an operator makes is saved in their browser. Its public page also has to
   reach everyone else, so whenever it is on sale online a copy of what a visitor
   needs goes to the server, and when it stops being on sale the copy comes down.
   A visitor's browser fetches that copy and lays it into its own store, so the
   ordinary page, basket and checkout simply work. Bookings a visitor makes stay
   with the visitor: without the backend there is nowhere shared for them to go.

   Goes with the rest of the mock when `client.ts` is replaced. */

export type PublishState = "off" | "sending" | "live" | "failed" | "taken" | "unavailable";

const OWNER_KEY = "cf_publisher_secret";
const RECORDS_KEY = "cf_published_items_v1";
const IMAGES_KEY = "cf_published_images_v1";
const STATE_EVENT = "cf-publish-state";

type PublishRecord = { slug: string; hash: string };

function readJson<T>(key: string, empty: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? "null") as T) ?? empty;
  } catch {
    return empty;
  }
}
function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full: the worst this costs is sending a photo or a page twice.
  }
}

function ownerSecret(): string {
  try {
    const known = localStorage.getItem(OWNER_KEY);
    if (known) return known;
    const made = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(OWNER_KEY, made);
    return made;
  } catch {
    return "";
  }
}

const states = new Map<string, PublishState>();
function setState(id: string, state: PublishState): void {
  if (states.get(id) === state) return;
  states.set(id, state);
  window.dispatchEvent(new Event(STATE_EVENT));
}

export const publishStateOf = (productId: string): PublishState => states.get(productId) ?? "off";
export function onPublishState(fn: () => void): () => void {
  window.addEventListener(STATE_EVENT, fn);
  return () => window.removeEventListener(STATE_EVENT, fn);
}

const isOnSaleOnline = (p: Product) => p.status === "active" && p.channels.includes("online");

const sha = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
};

/** What a visitor's browser needs to draw the page and take a booking. Nothing the
 *  operator keeps to themselves: no contact details of staff, no orders, no customers. */
async function snapshotOf(p: Product, slug: string): Promise<PublishedSnapshot | null> {
  const page = await getItemPage(slug);
  if (!page.ok) return null;
  const op = getOperatorState();
  const staffIds = new Set([...(p.schedule?.guideIds ?? []), ...(p.providerIds ?? [])]);
  return {
    v: 1,
    slug,
    product: { ...page.data.product, slug },
    location: page.data.location as unknown as PublishedSnapshot["location"],
    // Its page exists only in this browser, so a visitor's copy must not link to it.
    storefront: { ...page.data.storefront, published: false, createdAt: "", updatedAt: "" } as unknown as PublishedSnapshot["storefront"],
    resources: peekResources().filter((r) => p.resourceIds?.includes(r.id)),
    seatLayouts: peekSeatLayouts().filter((l) => l.id === p.layoutId),
    team: peekStaff()
      .filter((s) => staffIds.has(s.id))
      .map((s) => ({ ...s, email: null, phone: null })),
    operator: { name: op.name, currency: op.currency, defaultTimezone: op.defaultTimezone, taxRatePct: op.taxRatePct, reducedRatePct: op.reducedRatePct },
  };
}

/** Photos are stored in the browser as data URLs. Each goes up once and the page refers to its address. */
async function withUploadedImages(json: string, secret: string): Promise<string> {
  const known = readJson<Record<string, string>>(IMAGES_KEY, {});
  let out = json;
  for (const dataUrl of new Set(json.match(/data:image\/jpeg;base64,[A-Za-z0-9+/=]+/g) ?? [])) {
    const key = await sha(dataUrl);
    if (!known[key]) {
      const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
      const res = await fetch("/api/published-images", { method: "POST", headers: { "x-cf-owner": secret, "Content-Type": "image/jpeg" }, body: bytes });
      if (!res.ok) await res.arrayBuffer();
      if (res.status === 503) throw Object.assign(new Error("off"), { status: 503 });
      if (!res.ok) throw new Error(`Photo upload: ${res.status}`);
      known[key] = ((await res.json()) as { url: string }).url;
      writeJson(IMAGES_KEY, known);
    }
    out = out.split(dataUrl).join(known[key]);
  }
  // Anything else inline (an old blob: address, a PNG from before) can't be shown to anyone else.
  return out.replace(/"(data|blob):[^"]*"/g, '""');
}

const takeDown = async (slug: string, secret: string) => {
  const res = await fetch(`/api/published/${slug}`, { method: "DELETE", headers: { "x-cf-owner": secret } });
  await res.arrayBuffer();
  return res;
};

async function publishOne(p: Product, recordKey: string, records: Record<string, PublishRecord>, secret: string): Promise<void> {
  const slug = slugOf(p);
  const before = records[recordKey];
  try {
    const snap = await snapshotOf(p, slug);
    if (!snap) return;
    const hash = await sha(JSON.stringify(snap));
    if (before?.hash === hash && before.slug === slug) {
      setState(p.id, "live");
      return;
    }
    setState(p.id, "sending");
    const body = await withUploadedImages(JSON.stringify(snap), secret);
    const res = await fetch(`/api/published/${slug}`, { method: "PUT", headers: { "x-cf-owner": secret, "Content-Type": "application/json" }, body });
    // Read to the end, whatever the answer: an unread response keeps the request open.
    await res.arrayBuffer();
    if (res.status === 503) return setState(p.id, "unavailable");
    if (res.status === 409) return setState(p.id, "taken");
    if (!res.ok) return setState(p.id, "failed");
    if (before && before.slug !== slug) await takeDown(before.slug, secret).catch(() => {});
    records[recordKey] = { slug, hash };
    setState(p.id, "live");
  } catch (e) {
    setState(p.id, (e as { status?: number }).status === 503 ? "unavailable" : "failed");
  }
}

let running = false;
let again = false;
async function sync(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  running = true;
  const secret = ownerSecret();
  const scope = currentSavedScope();
  const records = readJson<Record<string, PublishRecord>>(RECORDS_KEY, {});
  const mine = peekProducts().filter((p) => isCreatedInThisBrowser("products", p.id));
  if (secret) {
    for (const p of mine) {
      const key = `${scope}:${p.id}`;
      if (isOnSaleOnline(p)) await publishOne(p, key, records, secret);
      else {
        if (records[key]) {
          const res = await takeDown(records[key].slug, secret).catch(() => null);
          if (res?.ok) delete records[key];
        }
        setState(p.id, "off");
      }
    }
    // Deleted since it was published.
    for (const key of Object.keys(records)) {
      if (key.startsWith(`${scope}:`) && !mine.some((p) => key === `${scope}:${p.id}`)) {
        const res = await takeDown(records[key].slug, secret).catch(() => null);
        if (res?.ok) delete records[key];
      }
    }
    writeJson(RECORDS_KEY, records);
  }
  running = false;
  if (again) {
    again = false;
    void sync();
  }
}

/** Try again after a failure, from the link card. */
export const retryPublishing = (): void => void sync();

/**
 * Ask the server for an item this browser doesn't have, and take it in.
 * This browser's own copy always wins: its owner may have just stopped selling it.
 */
export async function fetchPublishedItem(slug: string): Promise<boolean> {
  if (productBySlug(slug)) return false;
  try {
    const res = await fetch(`/api/published/${slug}`, { cache: "no-store" });
    if (!res.ok) {
      await res.arrayBuffer();
      return false;
    }
    adoptPublished(((await res.json()) as { doc: PublishedSnapshot }).doc);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void sync(), 400);
  };
  onCatalogueWrite(soon);
  // What was saved before now, or failed last time, goes up when the app next opens.
  soon();
  window.addEventListener("online", soon);
}
