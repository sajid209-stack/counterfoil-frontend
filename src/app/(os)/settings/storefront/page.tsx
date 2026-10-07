"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Globe, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { ActionMenu, Button, EmptyState, Modal, PageShell, StatusPill, useToast } from "@/components/ui";
import type { ActionMenuItem } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  deleteStorefront,
  duplicateStorefront,
  listLocations,
  listProducts,
  peekStorefrontsFor,
  setStorefrontPublished,
  storefrontName,
  storefrontProducts,
  type Location,
  type Product,
  type Storefront,
} from "@/lib/api";
import { IconTile, RecordRow, SectionSkeleton } from "../_components/SettingsKit";
import { AddStorefrontDialog } from "./_components/AddStorefrontDialog";

/**
 * The venues, and under each one the storefronts it has.
 *
 * A venue can have several — the same grounds sell tours from one page and
 * courts from another — so the list is grouped: a venue header carrying the
 * one thing you do to a venue here (add a storefront), and a row for each
 * storefront under it. A venue with none says so, in one line, and offers the
 * same button.
 *
 * Each row answers the only questions worth asking from outside — what is it
 * called, where is it, what is on it and is it online — and carries the
 * actions an operator reaches for, in a menu so that opening a row and
 * pressing one of them can never be the same press.
 *
 * It reads the store directly (`peekStorefrontsFor`) and re-renders after each
 * change: the list is the screen that is always open when a storefront is
 * added, copied, put online or deleted from somewhere else on the page.
 */
export default function StorefrontsPage() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const [, setTick] = useState(0);
  const refresh = () => setTick((n) => n + 1);
  const [adding, setAdding] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<Storefront | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const locations = locationsQ.data?.data ?? [];
  const products = (productsQ.data?.data ?? []) as Product[];

  const publish = async (sf: Storefront, location: Location, next: boolean) => {
    setBusyId(sf.id);
    const res = await setStorefrontPublished(sf.id, next);
    setBusyId(null);
    refresh();
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t(next ? "storefront.published" : "storefront.unpublished", { name: storefrontName(sf, location) }));
  };

  const duplicate = async (sf: Storefront, location: Location) => {
    setBusyId(sf.id);
    const res = await duplicateStorefront(sf.id);
    setBusyId(null);
    refresh();
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("storefront.duplicated", { name: storefrontName(res.data, location) }));
  };

  const remove = async () => {
    if (!deleting) return;
    const sf = deleting;
    const name = storefrontName(sf, locations.find((l) => l.id === sf.locationId));
    setBusyId(sf.id);
    const res = await deleteStorefront(sf.id);
    setBusyId(null);
    setDeleting(null);
    refresh();
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("storefront.deleted", { name }));
  };

  if ((locationsQ.loading && !locationsQ.data) || (productsQ.loading && !productsQ.data)) {
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
          <ul aria-label={t("storefront.listLabel")} className="flex flex-col gap-section">
            {locations.map((l) => {
              const list = peekStorefrontsFor(l.id);
              const live = list.filter((s) => s.published).length;
              const headingId = `sf-venue-${l.id}`;
              return (
                <li key={l.id}>
                  <section aria-labelledby={headingId} data-venue={l.id} className="card-surface">
                    <header className="flex flex-wrap items-center gap-x-section gap-y-tight px-card py-comfortable">
                      <IconTile icon={Globe} />
                      <div className="min-w-0 flex-1 basis-40">
                        <h2 id={headingId} className="text-sm font-semibold text-fg">
                          {l.name}
                        </h2>
                        {list.length > 0 && (
                          <p className="mt-inline text-[13px] text-muted">
                            {t("storefront.venueCount", { count: list.length, live })}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Plus size={16} strokeWidth={1.5} />}
                        aria-label={t("storefront.addStorefrontFor", { name: l.name })}
                        onClick={() => setAdding(l)}
                        className="shrink-0 max-sm:w-full"
                      >
                        {t("storefront.addStorefront")}
                      </Button>
                    </header>

                    {list.length === 0 ? (
                      <p className="border-t border-hairline px-card py-comfortable text-sm text-muted">
                        {t("storefront.venueEmpty", { name: l.name })}
                      </p>
                    ) : (
                      <ul aria-label={l.name} className="divide-y divide-hairline border-t border-hairline [&>li:last-child>a]:rounded-b-md">
                        {list.map((sf) => {
                          const name = storefrontName(sf, l);
                          const on = storefrontProducts(sf, products);
                          /* The only live storefront at a venue cannot be deleted
                             — see `deleteStorefront`. Said in the menu, not only
                             on pressing, so the disabled item is a rule and not
                             a fault. */
                          const lastLive = sf.published && live === 1;
                          const items: ActionMenuItem[] = [
                            {
                              key: "open",
                              label: t("storefront.menuOpen"),
                              icon: <ExternalLink size={14} strokeWidth={1.5} aria-hidden />,
                              disabled: !sf.published,
                              hint: sf.published ? undefined : t("storefront.statusDraft"),
                              onSelect: () => window.open(`/s/${sf.slug}`, "_blank", "noopener"),
                            },
                            {
                              key: "edit",
                              label: t("storefront.menuEdit"),
                              icon: <Pencil size={14} strokeWidth={1.5} aria-hidden />,
                              onSelect: () => router.push(`/settings/storefront/${sf.id}`),
                            },
                            {
                              key: "publish",
                              label: t(sf.published ? "storefront.menuUnpublish" : "storefront.menuPublish"),
                              icon: <Power size={14} strokeWidth={1.5} aria-hidden />,
                              onSelect: () => void publish(sf, l, !sf.published),
                            },
                            {
                              key: "duplicate",
                              label: t("storefront.menuDuplicate"),
                              icon: <Copy size={14} strokeWidth={1.5} aria-hidden />,
                              onSelect: () => void duplicate(sf, l),
                            },
                            {
                              key: "delete",
                              label: t("storefront.menuDelete"),
                              icon: <Trash2 size={14} strokeWidth={1.5} aria-hidden />,
                              destructive: true,
                              separated: true,
                              disabled: lastLive,
                              hint: lastLive ? t("storefront.deleteBlockedHint") : undefined,
                              onSelect: () => setDeleting(sf),
                            },
                          ];
                          return (
                            <RecordRow
                              key={sf.id}
                              href={`/settings/storefront/${sf.id}`}
                              title={name}
                              badges={
                                <StatusPill tone={sf.published ? "success" : "neutral"}>
                                  {t(sf.published ? "storefront.statusLive" : "storefront.statusDraft")}
                                </StatusPill>
                              }
                              meta={[
                                `/s/${sf.slug}`,
                                on.length ? t("storefront.onCount", { count: on.length }) : t("storefront.nothingOn"),
                              ].join(" · ")}
                              menu={<ActionMenu label={t("storefront.rowActions", { name })} items={items} />}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {adding && (
        <AddStorefrontDialog
          location={adding}
          products={products}
          onClose={() => setAdding(null)}
          onCreated={(sf) => {
            setAdding(null);
            router.push(`/settings/storefront/${sf.id}`);
          }}
        />
      )}

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t("storefront.deleteTitle", { name: deleting ? storefrontName(deleting, locations.find((l) => l.id === deleting.locationId)) : "" })}
        description={
          deleting ? t(deleting.published ? "storefront.deleteBodyLive" : "storefront.deleteBodyDraft", { slug: deleting.slug }) : undefined
        }
        size="sm"
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={() => setDeleting(null)} disabled={busyId !== null}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" loading={busyId !== null && !!deleting && busyId === deleting.id} onClick={() => void remove()}>
              {t("storefront.deleteConfirm")}
            </Button>
          </>
        }
      />
    </PageShell>
  );
}
