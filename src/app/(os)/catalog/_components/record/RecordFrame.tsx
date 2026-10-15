"use client";

import { useCallback, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ActionMenu, Button, Notice, PageShell, StatusPill, Tabs, tabPanelProps, type ActionMenuItem, type PillTone } from "@/components/ui";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { SaveBar } from "@/app/(os)/settings/_components/SettingsKit";
import type { CatalogState } from "@/lib/catalog";
import type { Blocker } from "@/lib/sellable";

/** The record's tabs, in the order a person works through an item. */
export type TabId = "overview" | "details" | "when" | "prices" | "where" | "page" | "rules" | "support";

export const STATE_TONE: Record<CatalogState, PillTone> = {
  onSale: "success",
  needsSetup: "warning",
  soldOut: "info",
  offSale: "neutral",
  ended: "neutral",
  archived: "neutral",
};

/** Which tab fixes each thing that stops an item selling. */
export const BLOCKER_TAB: Record<Blocker, TabId> = {
  noPrice: "prices",
  noTicket: "prices",
  noSchedule: "when",
  noResource: "when",
  noDate: "when",
  noVenue: "where",
  noChannel: "where",
};

export interface RecordTab {
  id: TabId;
  label: string;
  node: ReactNode;
  count?: number;
}

/**
 * The tab lives in the address (`?tab=where`), so a tab is a link: it can be
 * bookmarked, shared, and survives a reload; Back steps out of it. An unknown
 * or hidden tab reads as the Overview rather than an empty page.
 */
export function useRecordTab(available: TabId[]): [TabId, (next: TabId) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const asked = params.get("tab") as TabId | null;
  const tab: TabId = asked && available.includes(asked) ? asked : "overview";
  const setTab = useCallback(
    (next: TabId) => {
      const qs = new URLSearchParams(params.toString());
      if (next === "overview") qs.delete("tab");
      else qs.set("tab", next);
      const s = qs.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return [tab, setTab];
}

/**
 * The record page's frame, the same for every booking: a way back, the state in
 * the header row (never a type), ONE primary action (Put on sale / Take
 * off sale) with everything else behind "…", the tabs, and the settings save bar
 * — present only while something has changed, on every tab, because a change
 * made on one tab is saved with the rest.
 */
export function RecordFrame({
  title,
  description,
  state,
  primary,
  secondary,
  menu,
  blockers,
  tabs,
  tab,
  onTab,
  dirty,
  saving,
  invalid,
  onSave,
  onDiscard,
  children,
}: {
  title: string;
  description?: string;
  state: CatalogState;
  primary?: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean };
  /** The rarer, riskier action (Stop selling): never the orange primary. */
  secondary?: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean };
  menu: ActionMenuItem[];
  blockers: Blocker[];
  tabs: RecordTab[];
  tab: TabId;
  onTab: (t: TabId) => void;
  dirty: boolean;
  saving: boolean;
  invalid: boolean;
  onSave: () => void;
  onDiscard: () => void;
  /** Dialogs and the like that belong to the record but not to a tab. */
  children?: ReactNode;
}) {
  const t = useTranslations("catalog");
  const tp = useTranslations("products");
  const ti = useTranslations("catalog.item");
  const wide = useMediaQuery(MD);
  const current = tabs.find((x) => x.id === tab) ?? tabs[0];
  const panelBase = "record";

  const blockerLabel = (b: Blocker) =>
    tp(
      b === "noPrice" ? "blockerNoPrice"
        : b === "noSchedule" ? "blockerNoSchedule"
        : b === "noResource" ? "blockerNoResource"
        : b === "noDate" ? "blockerNoDate"
        : b === "noVenue" ? "blockerNoVenue"
        : b === "noTicket" ? "blockerNoTicket"
        : "blockerNoChannel",
    );
  const fixTab = blockers.length ? BLOCKER_TAB[blockers[0]] : null;
  const fixLabel = fixTab ? tabs.find((x) => x.id === fixTab)?.label : undefined;

  return (
    <PageShell
      title={title}
      description={description}
      back={{ href: "/catalog", label: t("title") }}
      status={
        <StatusPill tone={STATE_TONE[state]} shape={state === "offSale" || state === "archived" ? "record" : "transaction"}>
          {t(`state.${state}`)}
        </StatusPill>
      }
      primary={primary}
      /* From md a menu. On a phone the bar's "…" already opens a panel, so the
         actions ARE its contents — a menu inside a panel is two taps to reach
         anything. */
      actions={
        wide ? (
          <div className="flex items-center gap-inline">
            {secondary && (
              <Button variant="secondary" icon={secondary.icon} onClick={secondary.onClick} disabled={secondary.disabled}>
                {secondary.label}
              </Button>
            )}
            <ActionMenu label={t("rowActions", { name: title })} items={menu} />
          </div>
        ) : (
          <div role="group" aria-label={t("rowActions", { name: title })} className="flex min-w-48 flex-col items-stretch gap-inline">
            {(secondary
              ? [{ key: "secondary", label: secondary.label, icon: secondary.icon, onSelect: secondary.onClick, disabled: secondary.disabled } as ActionMenuItem, ...menu]
              : menu
            ).map((it) => (
              <div key={it.key} className="flex flex-col">
                {it.separated && <span aria-hidden className="my-inline border-t border-hairline" />}
                <Button
                  variant={it.destructive ? "destructive" : "tertiary"}
                  onClick={it.onSelect}
                  disabled={it.disabled}
                  icon={it.icon}
                  className="justify-start"
                >
                  {it.label}
                </Button>
                {it.disabled && it.hint && <span className="px-comfortable pb-inline text-xs text-muted">{it.hint}</span>}
              </div>
            ))}
          </div>
        )
      }
    >
      <div className="flex flex-col gap-section">
        {blockers.length > 0 && (
          <Notice
            tone="warning"
            title={ti("notReady")}
            action={fixTab && fixTab !== tab ? { label: ti("fixIt", { tab: fixLabel ?? "" }), onClick: () => onTab(fixTab) } : undefined}
          >
            {ti("notReadyBody", { reasons: blockers.map(blockerLabel).join(" · ") })}
          </Notice>
        )}

        <Tabs
          id={panelBase}
          aria-label={ti("tabsLabel")}
          items={tabs.map((x) => ({ value: x.id, label: x.label, count: x.count }))}
          value={current.id}
          onChange={(v) => onTab(v as TabId)}
        />

        <div {...tabPanelProps(panelBase, current.id)} className="flex min-w-0 flex-col gap-section outline-none">
          {current.node}
        </div>

        {/* Present only while something has changed. Discard puts the whole
            record back as it was loaded; Save writes every tab at once. */}
        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={onSave} onDiscard={onDiscard} />
      </div>
      {children}
    </PageShell>
  );
}
