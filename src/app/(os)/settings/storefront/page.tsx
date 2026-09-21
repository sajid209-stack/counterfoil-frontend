"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { EmptyState, PageShell, StatusPill, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getStorefrontFor,
  listLocations,
  listProducts,
  setStorefrontPublished,
  storefrontProducts,
  type Location,
  type Product,
  type Storefront,
} from "@/lib/api";
import { IconTile, RecordList, RecordRow, SectionSkeleton, Switch } from "../_components/SettingsKit";

/**
 * A page per venue, listed the way the venues are.
 *
 * Every location has one whether or not anybody has opened it — the record is
 * minted on first read rather than at seed time, so a venue created this
 * morning has a page too and nothing has to remember to create one alongside
 * it. What the list answers is the only question worth asking from outside:
 * is this page live, and what is on it.
 */
export default function StorefrontsPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const [sheets, setSheets] = useState<Record<string, Storefront>>({});
  const [busy, setBusy] = useState<string | null>(null);

  /* Memoised: a fresh array each render would re-run the effect below, and
     that effect mints records and reserves slugs. */
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const products = productsQ.data?.data ?? [];

  /* One read per venue, minting the record where there is none. Sequential on
     purpose: each mint reserves a slug, and two in flight could pick the same
     one before either had been written. */
  useEffect(() => {
    if (!locations.length) return;
    let alive = true;
    (async () => {
      const out: Record<string, Storefront> = {};
      for (const l of locations) {
        const res = await getStorefrontFor(l.id);
        if (res.ok) out[l.id] = res.data;
      }
      if (alive) setSheets(out);
    })();
    return () => { alive = false; };
  }, [locations]);

  const publish = async (sf: Storefront, location: Location, next: boolean) => {
    setBusy(sf.id);
    const res = await setStorefrontPublished(sf.id, next);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setSheets((m) => ({ ...m, [location.id]: res.data }));
    toast.success(t(next ? "storefront.published" : "storefront.unpublished", { name: location.name }));
  };

  if (locationsQ.loading || productsQ.loading) {
    return (
      <PageShell title={t("storefront.title")} description={t("storefront.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("storefront.title")} description={t("storefront.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        {locations.length === 0 ? (
          <EmptyState title={t("storefront.emptyTitle")} message={t("storefront.emptyMessage")} />
        ) : (
          <RecordList label={t("storefront.listLabel")}>
            {locations.map((l) => {
              const sf = sheets[l.id];
              const on = sf ? storefrontProducts(sf, products as Product[]) : [];
              return (
                <RecordRow
                  key={l.id}
                  href={sf ? `/settings/storefront/${l.id}` : "#"}
                  leading={<IconTile icon={Globe} />}
                  title={l.name}
                  badges={sf && !sf.published ? <StatusPill status="inactive">{t("storefront.draft")}</StatusPill> : undefined}
                  meta={
                    sf
                      ? [
                          `/s/${sf.slug}`,
                          on.length ? t("storefront.onCount", { count: on.length }) : t("storefront.nothingOn"),
                        ].join(" · ")
                      : t("storefront.preparing")
                  }
                  control={
                    sf ? (
                      <Switch
                        checked={sf.published}
                        disabled={busy === sf.id}
                        onChange={(next) => publish(sf, l, next)}
                        label={t("storefront.publishSwitch", { name: l.name })}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </RecordList>
        )}
      </div>
    </PageShell>
  );
}
