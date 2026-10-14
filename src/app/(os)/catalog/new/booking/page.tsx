import { redirect } from "next/navigation";
import { NewItemPage } from "../../_components/wizard/NewItemPage";
import { isRouteKind } from "../../_components/wizard/kinds";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * The old booking address. `?kind=timed` moves to `/catalog/new/timed`.
 *
 * With no kind this is the "Not sure?" door: the wizard opens on the whole
 * question tree ("How do people book it?") instead of on a chooser card's
 * answer, so it stays a page of its own rather than a redirect.
 */
export default async function NewBooking({ searchParams }: { searchParams: Promise<Search> }) {
  const kind = one((await searchParams).kind);
  if (isRouteKind(kind)) redirect(`/catalog/new/${kind}`);
  if (kind === "events" || kind === "bookings") redirect(`/catalog/new?kind=${kind}`);
  return <NewItemPage kind="booking" />;
}
