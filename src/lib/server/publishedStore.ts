import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { del, head, put } from "@vercel/blob";

/* Where a published item's page lives, so a link opens for anybody, on any device.

   This is the stopgap the swap point (`lib/api/client.ts`) has until the backend
   is connected: it holds what a visitor needs to read a page and nothing else, and
   it goes when `client.ts` is replaced. There are no accounts here yet, so an item
   belongs to whoever published it first, proved by a secret kept in their browser.

   Vercel Blob when its token is set. PUBLISHED_LOCAL_DIR swaps in a folder, for
   testing on a machine with no store. With neither, publishing is simply off. */

export interface PublishedRecord {
  ownerHash: string;
  doc: unknown;
}

interface Backend {
  read(path: string): Promise<Buffer | null>;
  /** Returns the address the file can be read from. */
  write(path: string, body: Buffer, contentType: string): Promise<string>;
  remove(path: string): Promise<void>;
}

const LOCAL_DIR = process.env.PUBLISHED_LOCAL_DIR;

const blobBackend: Backend = {
  async read(path) {
    try {
      const found = await head(path);
      /* The version in the address steps around the CDN's copy, so an edit shows at once. */
      const res = await fetch(`${found.url}?v=${found.uploadedAt.getTime()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Blob read failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (e instanceof Error && e.name === "BlobNotFoundError") return null;
      throw e;
    }
  },
  async write(path, body, contentType) {
    const saved = await put(path, body, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 60 });
    return saved.url;
  },
  async remove(path) {
    await del(path);
  },
};

const localBackend = (dir: string): Backend => ({
  async read(path) {
    try {
      return await readFile(join(dir, path));
    } catch {
      return null;
    }
  },
  async write(path, body) {
    const file = join(dir, path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, body);
    return `/api/published-images?file=${encodeURIComponent(path)}`;
  },
  async remove(path) {
    await rm(join(dir, path), { force: true });
  },
});

const backend = (): Backend | null => {
  if (LOCAL_DIR) return localBackend(LOCAL_DIR);
  return process.env.BLOB_READ_WRITE_TOKEN ? blobBackend : null;
};

export const publishingAvailable = (): boolean => backend() !== null;

export const SLUG_OK = /^[a-z0-9][a-z0-9-]{0,99}$/;
const docPath = (slug: string) => `published/items/${slug}.json`;

/* Every visit asks for the page twice, once for the status and title and once for
   the content. A short memory keeps that from being two trips to the store. */
const recent = new Map<string, { at: number; record: PublishedRecord }>();
const REMEMBER_MS = 10_000;

export async function readPublished(slug: string): Promise<PublishedRecord | null> {
  const store = backend();
  if (!store || !SLUG_OK.test(slug)) return null;
  const known = recent.get(slug);
  if (known && Date.now() - known.at < REMEMBER_MS) return known.record;
  const body = await store.read(docPath(slug));
  if (!body) {
    recent.delete(slug);
    return null;
  }
  const record = JSON.parse(body.toString("utf8")) as PublishedRecord;
  recent.set(slug, { at: Date.now(), record });
  return record;
}

/** The page's public data, or null if there is none or the store can't be read. A failed read is not an error to a visitor. */
export async function readPublishedDoc(slug: string): Promise<unknown> {
  try {
    return (await readPublished(slug))?.doc ?? null;
  } catch {
    return null;
  }
}

export async function writePublished(slug: string, record: PublishedRecord): Promise<void> {
  const store = backend();
  if (!store) throw new Error("Publishing is off");
  await store.write(docPath(slug), Buffer.from(JSON.stringify(record)), "application/json");
  recent.set(slug, { at: Date.now(), record });
}

export async function removePublished(slug: string): Promise<void> {
  const store = backend();
  if (!store) throw new Error("Publishing is off");
  await store.remove(docPath(slug));
  recent.delete(slug);
}

/** An uploaded photo. Named by its content, so the same photo is only ever stored once. */
export async function writePublishedImage(bytes: Buffer): Promise<string> {
  const store = backend();
  if (!store) throw new Error("Publishing is off");
  const name = createHash("sha256").update(bytes).digest("hex");
  return store.write(`published/images/${name}.jpg`, bytes, "image/jpeg");
}

/** For the local test folder only: Blob serves its own files. */
export async function readLocalImage(path: string): Promise<Buffer | null> {
  if (!LOCAL_DIR || !/^published\/images\/[0-9a-f]{64}\.jpg$/.test(path)) return null;
  return localBackend(LOCAL_DIR).read(path);
}

export const hashOwner = (secret: string): string => createHash("sha256").update(secret).digest("hex");
