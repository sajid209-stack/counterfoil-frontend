import { redirect } from "next/navigation";
import { NewItemPage } from "../../_components/wizard/NewItemPage";
import { isEventType, isRouteKind } from "../../_components/wizard/kinds";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * `/catalog/new/<kind>`: one wizard for everything that can be sold.
 *
 * <kind> is entry · timed · tour · space · appointment · course · pass · bundle
 * · event. For an event, `?type=` is the kind of event: entertainment · sports ·
 * business · arts · travel · nightlife (no type opens on entertainment, with the
 * kind one tap away in the Name step). Any other kind goes back to the chooser.
 *
 * The old event address, `/catalog/new/event?category=sports`, still lands on
 * the right wizard: `category` is the old name of `type`.
 */
export default async function NewItem({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Search> }) {
  const { kind } = await params;
  const sp = await searchParams;
  if (!isRouteKind(kind)) redirect("/catalog/new");
  if (kind === "event") {
    const type = one(sp.type);
    const legacy = one(sp.category);
    if (!isEventType(type) && isEventType(legacy)) redirect(`/catalog/new/event?type=${legacy}`);
    return <NewItemPage kind="event" eventType={isEventType(type) ? type : null} />;
  }
  return <NewItemPage kind={kind} />;
}
