import { redirect } from "next/navigation";

/**
 * An event's old public address. Every item — an event included — now has its
 * own link at /b/<slug>, drawn by the same page renderer, so /e/<slug> only
 * forwards there, keeping any query string (a campaign tag on a printed link
 * must survive the move).
 */
export default async function LegacyEventLink({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, v);
  }
  const qs = query.toString();
  redirect(`/b/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`);
}
