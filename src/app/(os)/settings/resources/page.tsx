"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LandPlot, Plus } from "lucide-react";
import { Button, EmptyState, PageShell, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listResources, ownerBusyDetailed, type Resource } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { DEMO_TODAY, toTime } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SectionSkeleton } from "../_components/SettingsKit";

/** The demo's "now": the same noon the till and the dashboard read. */
const NOW_MIN = 12 * 60;

/**
 * Resources, grouped by what they are.
 *
 * One table mixed a centre court, two fields and four lanes, with a Type column
 * repeating the word down the rows and the page titled "Courts" over all of it
 * when the first row happened to be a court. The groups are now the kinds —
 * Courts, Fields, Lanes — so the heading is always true, and each row says where
 * it is and what it is doing right now. Out of service is said with its reason;
 * a price that differs from the booking's is said beside it.
 */
export default function ResourcesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const resources = resourcesQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];
  const uniform = resources.length > 0 && resources.every((r) => r.nounSingular === resources[0].nounSingular);
  const title = uniform ? resources[0].nounPlural : t("nav.items.resources.title");
  const addLabel = uniform ? t("resources.addResource", { noun: resources[0].nounSingular }) : t("resources.addGeneric");

  const kinds = Array.from(new Set(resources.map((r) => r.nounPlural))).sort((a, b) => a.localeCompare(b));
  // A business with one venue does not need "Lalbagh Fort" printed on every
  // row; the place is only information once there is more than one.
  const onePlace = new Set(resources.map((r) => r.locationId)).size <= 1;

  const now = (r: Resource): { text: string; warn: boolean } => {
    if (r.outOfService) {
      return {
        text: r.outOfServiceReason ? t("resources.outWithReason", { reason: r.outOfServiceReason }) : t("resources.outOfService"),
        warn: true,
      };
    }
    const spans = ownerBusyDetailed(r.id, DEMO_TODAY);
    const current = spans.find((s) => s.start <= NOW_MIN && NOW_MIN < s.end);
    if (current) return { text: t("resources.inUseUntil", { time: toTime(current.end), label: current.label }), warn: false };
    const next = spans.find((s) => s.start > NOW_MIN);
    return { text: next ? t("resources.freeNext", { time: toTime(next.start) }) : t("resources.free"), warn: false };
  };

  const rate = (r: Resource) =>
    !r.rateOverride
      ? null
      : r.rateOverride.kind === "premium"
        ? t("resources.ratePremiumShort", { amount: formatPriceShort(r.rateOverride.amount) })
        : t("resources.rateReplaceShort", { amount: formatPriceShort(r.rateOverride.amount) });

  return (
    <PageShell
      title={title}
      description={t("resources.descriptionList")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/resources/new")}>
          {addLabel}
        </Button>
      }
    >
      {resourcesQ.loading || locationsQ.loading ? (
        <SectionSkeleton />
      ) : resources.length === 0 ? (
        <div className="max-w-3xl">
          <EmptyState
            title={t("resources.emptyTitle")}
            message={t("resources.emptyMessage")}
            action={<Button onClick={() => router.push("/settings/resources/new")}>{t("resources.emptyAction")}</Button>}
          />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-wide pb-hero">
          {kinds.map((kind) => {
            const group = resources.filter((r) => r.nounPlural === kind).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            const headingId = `resources-${kind}`;
            return (
              <section key={kind} aria-labelledby={headingId} className="flex flex-col gap-tight">
                <h2 id={headingId} className="text-base font-semibold text-fg">
                  {kind} <span className="font-normal text-muted">{group.length}</span>
                </h2>
                <RecordList label={kind}>
                  {group.map((r) => {
                    const state = now(r);
                    const place = locations.find((l) => l.id === r.locationId)?.name ?? t("resources.noLocation");
                    return (
                      <RecordRow
                        key={r.id}
                        href={`/settings/resources/${r.id}`}
                        leading={<IconTile icon={LandPlot} />}
                        title={r.name}
                        badges={
                          r.outOfService ? (
                            <StatusPill tone="danger">{t("resources.outOfService")}</StatusPill>
                          ) : r.status !== "active" ? (
                            <StatusPill status={r.status} />
                          ) : null
                        }
                        meta={
                          <>
                            {onePlace ? null : <span className="block">{place}</span>}
                            <span className={cn("block", state.warn ? "text-danger" : undefined)}>{state.text}</span>
                          </>
                        }
                        aside={rate(r)}
                      />
                    );
                  })}
                </RecordList>
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
