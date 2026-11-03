import { NextResponse } from "next/server";
import { publishingAvailable, readLocalImage, writePublishedImage } from "@/lib/server/publishedStore";

/** The browser shrinks a photo to 1280px at most before it gets here. Vercel refuses bodies over 4.5 MB anyway. */
const MAX_IMAGE_BYTES = 1_500_000;

/** Store one photo for a published page and say where it can be read. */
export async function POST(req: Request) {
  // Read it before any refusal: a body left unread keeps the browser's request hanging.
  const bytes = Buffer.from(await req.arrayBuffer());
  if (!publishingAvailable()) return NextResponse.json({}, { status: 503 });
  if (!(req.headers.get("x-cf-owner")?.length ?? 0)) return NextResponse.json({}, { status: 400 });
  if (bytes.length > MAX_IMAGE_BYTES) return NextResponse.json({}, { status: 413 });
  // Only ever a JPEG: it is what the browser makes, and it can't carry a script.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return NextResponse.json({}, { status: 422 });
  try {
    return NextResponse.json({ url: await writePublishedImage(bytes) });
  } catch {
    return NextResponse.json({}, { status: 502 });
  }
}

/** Serves the test folder's photos. On Vercel Blob they have their own address and this answers 404. */
export async function GET(req: Request) {
  const bytes = await readLocalImage(new URL(req.url).searchParams.get("file") ?? "");
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "image/jpeg" } });
}
