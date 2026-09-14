"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, LandPlot, Plus, RotateCcw } from "lucide-react";
import { ActionMenu, Button, ConfirmDialog, EmptyState, Modal, PageShell, StatusPill, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listResources, ownerBusyDetailed, updateResource, type Resource } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { DEMO_TODAY, toTime } from "@/lib/schedule";
import { IconTile, RecordList, RecordRow, SectionSkeleton, Switch, controlCls } from "../_components/SettingsKit";

/** The demo's "now": the same noon the till and the dashboard read. */
const NOW_MIN = 12 * 60;

type Tab = "all" | "available" | "out" | "retired";
const TABS: Tab[] = ["all", "available", "out", "retired"];

/**
 * Resources, grouped by what they are.
 *
 * One table mixed a centre court, two fields and four lanes under a Type column
 * repeating the word down the rows. The groups are now the kinds — Courts,
 * Fields, Lanes — and each row says what it is doing right now.
 *
 * Taking a lane out of service is the thing done to a resource most often, and
 * it was two screens deep. Each row now carries an "available for booking"
 * switch. Turning one back on is immediate, with Undo. Taking one out asks for
 * the reason first, because the reason is not decoration — the till shows it
 * to staff, so a customer asking why lane 3 is shut gets an answer. Retiring,
 * which is permanent in intent, lives in the row menu rather than on a switch.
 */
export default function ResourcesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const reasonId = useId();
  const [tab, setTab] = useState<Tab>("all");
  const [latest, setLatest] = useState<Record<string, Resource>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [taking, setTaking] = useState<{ resource: Resource; reason: string } | null>(null);
  const [retiring, setRetiring] = useState<Resource | null>(null);

  const resourcesQ = useApiQuery(() => listResources({ pageSize: 500 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 200 }), []);

  const resources = (resourcesQ.data?.data ?? []).map((r) => latest[r.id] ?? r).filter((r) => r.status !== "archived");
  const locations = locationsQ.data?.data ?? [];
  const loading = !resourcesQ.data || !locationsQ.data;
  const uniform = resources.length > 0 && resources.every((r) => r.nounSingular === resources[0].nounSingular);
  const title = uniform ? resources[0].nounPlural : t("nav.items.resources.title");
  const addLabel = uniform ? t("resources.addResource", { noun: resources[0].nounSingular }) : t("resources.addGeneric");
  // A business with one venue does not need its name printed on every row; the
  // place is only information once there is more than one.
  const onePlace = new Set(resources.map((r) => r.locationId)).size <= 1;

  const isAvailable = (r: Resource) => r.status === "active" && !r.outOfService;
  const counts: Record<Tab, number> = {
    all: resources.length,
    available: resources.filter(isAvailable).length,
    out: resources.filter((r) => r.status === "active" && r.outOfService).length,
    retired: resources.filter((r) => r.status === "inactive").length,
  };
  const inTab = (r: Resource) =>
    tab === "all"
      ? true
      : tab === "available"
        ? isAvailable(r)
        : tab === "out"
          ? r.status === "active" && r.outOfService
          : r.status === "inactive";

  const now = (r: Resource): { text: string; warn: boolean } => {
    if (r.status === "inactive") return { text: t("resources.usingOff"), warn: false };
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

  const write = async (r: Resource, patch: Partial<Resource>): Promise<Resource | null> => {
    setBusy(r.id);
    const res = await updateResource(r.id, patch);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return null;
    }
    setLatest((m) => ({ ...m, [r.id]: res.data }));
    return res.data;
  };

  const backInService = async (r: Resource, undoable = true) => {
    const reason = r.outOfServiceReason;
    const next = await write(r, { outOfService: false, outOfServiceReason: null });
    if (!next || !undoable) return;
    toast.success(t("resources.backIn", { name: r.name }), {
      label: t("common.undo"),
      run: () => takeOut(next, reason ?? "", false),
    });
  };

  const takeOut = async (r: Resource, reason: string, undoable = true) => {
    const next = await write(r, { outOfService: true, outOfServiceReason: reason.trim() || null });
    setTaking(null);
    if (!next || !undoable) return;
    toast.success(t("resources.tookOut", { name: r.name }), {
      label: t("common.undo"),
      run: () => backInService(next, false),
    });
  };

  const setRetired = async (r: Resource, retired: boolean) => {
    const next = await write(r, { status: retired ? "inactive" : "active" });
    setRetiring(null);
    if (next) toast.success(retired ? t("resources.retired", { name: r.name }) : t("resources.restored", { name: r.name }));
  };

  const visible = resources.filter(inTab);
  const kinds = Array.from(new Set(visible.map((r) => r.nounPlural))).sort((a, b) => a.localeCompare(b));

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
      {loading ? (
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
        <div className="flex max-w-4xl flex-col gap-section pb-hero">
          <Tabs
            items={TABS.map((v) => ({ value: v, label: t(`resources.tab.${v}`), count: counts[v] }))}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
          {visible.length === 0 ? (
            <p className="py-section text-sm text-muted">{t("resources.emptyTab")}</p>
          ) : (
            <div className="flex flex-col gap-wide">
              {kinds.map((kind) => {
                const group = visible
                  .filter((r) => r.nounPlural === kind)
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
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
                        const retired = r.status === "inactive";
                        return (
                          <RecordRow
                            key={r.id}
                            href={`/settings/resources/${r.id}`}
                            leading={<IconTile icon={LandPlot} />}
                            title={r.name}
                            badges={
                              retired ? (
                                <StatusPill tone="neutral">{t("resources.retiredTag")}</StatusPill>
                              ) : r.outOfService ? (
                                <StatusPill tone="danger">{t("resources.outOfService")}</StatusPill>
                              ) : null
                            }
                            meta={
                              <>
                                {onePlace ? null : <span className="block">{place}</span>}
                                <span className={cn("block", state.warn ? "text-danger" : undefined)}>{state.text}</span>
                                {rate(r) ? <span className="block">{rate(r)}</span> : null}
                              </>
                            }
                            control={
                              retired ? null : (
                                <Switch
                                  checked={!r.outOfService}
                                  disabled={busy === r.id}
                                  onChange={(on) => (on ? backInService(r) : setTaking({ resource: r, reason: "" }))}
                                  label={t("resources.availableSwitch", { name: r.name })}
                                />
                              )
                            }
                            menu={
                              <ActionMenu
                                label={t("resources.actionsFor", { name: r.name })}
                                items={
                                  retired
                                    ? [
                                        {
                                          key: "restore",
                                          label: t("resources.restore"),
                                          icon: <RotateCcw size={16} strokeWidth={1.5} />,
                                          onSelect: () => setRetired(r, false),
                                        },
                                      ]
                                    : [
                                        {
                                          key: "retire",
                                          label: t("resources.retire"),
                                          icon: <Archive size={16} strokeWidth={1.5} />,
                                          destructive: true,
                                          onSelect: () => setRetiring(r),
                                        },
                                      ]
                                }
                              />
                            }
                          />
                        );
                      })}
                    </RecordList>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Modal
        open={taking !== null}
        onClose={() => setTaking(null)}
        title={taking ? t("resources.outTitle", { name: taking.resource.name }) : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTaking(null)}>
              {t("save.cancel")}
            </Button>
            <Button
              loading={busy !== null}
              onClick={() => {
                if (taking) takeOut(taking.resource, taking.reason);
              }}
            >
              {t("resources.takeOut")}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted">{t("resources.outBody")}</p>
        <label htmlFor={reasonId} className="mt-section block text-sm font-medium text-fg">
          {t("resources.reason")}
        </label>
        <input
          id={reasonId}
          autoFocus
          value={taking?.reason ?? ""}
          placeholder={t("resources.reasonPlaceholder")}
          onChange={(e) => setTaking((cur) => (cur ? { ...cur, reason: e.target.value } : cur))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && taking) takeOut(taking.resource, taking.reason);
          }}
          className={cn(controlCls(), "mt-tight")}
        />
      </Modal>

      <ConfirmDialog
        open={retiring !== null}
        onClose={() => setRetiring(null)}
        onConfirm={() => {
          if (retiring) setRetired(retiring, true);
        }}
        title={retiring ? t("resources.retireTitle", { name: retiring.name }) : ""}
        message={t("resources.retireBody")}
        confirmLabel={t("resources.retire")}
        loading={busy !== null}
      />
    </PageShell>
  );
}
