import { NextResponse } from "next/server";
import { demoItemAtSlug, productBySlug } from "@/lib/api/products";
import { hashOwner, publishingAvailable, readPublished, readPublishedDoc, removePublished, SLUG_OK, writePublished } from "@/lib/server/publishedStore";

/** A page is text: its photos are uploaded on their own and referred to by address. */
const MAX_DOC_BYTES = 256 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };
const answer = (status: number, body: object = {}) => NextResponse.json(body, { status, headers: NO_STORE });

const secretOf = (req: Request): string | null => {
  const s = req.headers.get("x-cf-owner");
  return s && s.length >= 32 && s.length <= 128 ? s : null;
};

type Params = { params: Promise<{ slug: string }> };

/** Anyone may read a published page: that is what publishing means. The owner's mark stays here. */
export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const doc = await readPublishedDoc(slug);
  return doc ? answer(200, { doc }) : answer(404);
}

/** Put a page online. The first browser to publish a link owns it. */
export async function PUT(req: Request, { params }: Params) {
  const { slug } = await params;
  // Read it before any refusal: a body left unread keeps the browser's request hanging.
  const text = await req.text();
  if (!publishingAvailable()) return answer(503);
  const secret = secretOf(req);
  if (!secret || !SLUG_OK.test(slug)) return answer(400);
  // A link the demo already answers belongs to the demo.
  if (productBySlug(slug) || demoItemAtSlug(slug)) return answer(409);

  if (Buffer.byteLength(text) > MAX_DOC_BYTES) return answer(413);
  let doc: { v?: unknown; slug?: unknown; product?: { name?: unknown; status?: unknown; channels?: unknown } };
  try {
    doc = JSON.parse(text);
  } catch {
    return answer(400);
  }
  const p = doc?.product;
  const shaped = doc?.v === 1 && doc.slug === slug && typeof p?.name === "string" && p.status === "active" && Array.isArray(p.channels) && p.channels.includes("online");
  if (!shaped) return answer(422);
  // Photos arrive as addresses. A page carrying its own bytes is not the page we built.
  if (/"data:|"blob:/.test(text)) return answer(422);

  const ownerHash = hashOwner(secret);
  try {
    const current = await readPublished(slug);
    if (current && current.ownerHash !== ownerHash) return answer(409);
    await writePublished(slug, { ownerHash, doc });
  } catch {
    return answer(502);
  }
  return answer(200, { ok: true });
}

/** Take a page down: only its owner may. */
export async function DELETE(req: Request, { params }: Params) {
  const { slug } = await params;
  if (!publishingAvailable()) return answer(503);
  const secret = secretOf(req);
  if (!secret || !SLUG_OK.test(slug)) return answer(400);
  try {
    const current = await readPublished(slug);
    if (!current) return answer(200, { ok: true });
    if (current.ownerHash !== hashOwner(secret)) return answer(409);
    await removePublished(slug);
  } catch {
    return answer(502);
  }
  return answer(200, { ok: true });
}
