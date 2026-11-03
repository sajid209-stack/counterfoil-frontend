"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, ClipboardList, MapPin, ScanLine, Smartphone, Store, Tablet, Zap, type LucideIcon } from "lucide-react";
import { Avatar, Button, ButtonLink, EmptyState, Notice, StatusPill } from "@/components/ui";
import { useEnumLabels } from "@/lib/labels";
import type { Counter, Device, Role, Staff } from "@/lib/api";
import type { AssignedCounter, AssignedVenue, Assignments } from "../../_lib/assignments";
import { useRoleSummary } from "../../_lib/roles";
import { IconTile, SearchField, SettingRow, SettingsSection } from "../../_components/SettingsKit";

/** Past this many counters a person scanning for one needs a search box. */
const SEARCH_FROM = 8;

/**
 * What the signed-in person can do, drawn from `buildAssignments`.
 *
 * Props only, with no fetching, so it can be rendered with fixture data and
 * checked without the mock backend. Read-only on purpose: assignments are a
 * manager's to set, so the one way out of here is a link to whoever can.
 */
export function AssignmentsView({
  me,
  role,
  assignments,
  thisTillId,
  onOpenTill,
}: {
  me: Staff;
  role: Role | undefined;
  assignments: Assignments;
  /** The counter this device is standing at, marked in the list. */
  thisTillId: string;
  onOpenTill: (counterId: string) => void;
}) {
  const t = useTranslations("settings.assignments");
  const { venues, counterCount, canManageTeam, needsPin, devices, managers } = assignments;
  const teamHref = `/settings/team/${me.id}`;

  const change = (
    <ChangeSection canManageTeam={canManageTeam} managers={managers} teamHref={teamHref} />
  );

  if (venues.length === 0) {
    return (
      <div className="flex flex-col gap-section">
        <div className="card-surface">
          <EmptyState
            icon={<ClipboardList size={20} strokeWidth={1.5} aria-hidden />}
            title={t("emptyTitle")}
            message={t("emptyBody")}
          />
        </div>
        {change}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <SummaryCard me={me} role={role} assignments={assignments} />

      {needsPin && (
        <Notice
          tone="warning"
          title={t("pinTitle")}
          action={canManageTeam ? { label: t("pinAction"), href: teamHref, variant: "button" } : undefined}
        >
          {canManageTeam ? t("pinBody") : `${t("pinBody")} ${t("pinAsk")}`}
        </Notice>
      )}

      <Venues
        venues={venues}
        counterCount={counterCount}
        canSell={assignments.canSell}
        thisTillId={thisTillId}
        onOpenTill={onOpenTill}
      />

      {devices.length > 0 && (
        <SettingsSection title={t("devicesTitle")} divided>
          {devices.map((d) => (
            <DeviceRow key={d.id} device={d} meId={me.id} venues={venues} />
          ))}
        </SettingsSection>
      )}

      {change}
    </div>
  );
}

/** One sentence that answers "where do I work", then what the role allows. */
function SummaryCard({ me, role, assignments }: { me: Staff; role: Role | undefined; assignments: Assignments }) {
  const t = useTranslations("settings.assignments");
  const tp = useTranslations("settings");
  const summarise = useRoleSummary();
  const { venues, counterCount } = assignments;
  const wide = me.workspaceWide === true;
  const place = venues[0].location.name;

  let lead: string;
  if (counterCount === 0) {
    lead = venues.length === 1 ? t("summaryNoneAt", { place }) : t("summaryNone", { venues: venues.length });
  } else if (wide) {
    lead = venues.length === 1 ? t("summaryWideAt", { place }) : t("summaryWide", { venues: venues.length });
  } else if (venues.length === 1) {
    lead = t("summaryAt", { count: counterCount, place });
  } else {
    lead = t("summaryVenues", { count: counterCount, venues: venues.length });
  }

  return (
    <div className="card-surface flex flex-col gap-section p-card">
      <p className="break-words text-lg font-semibold text-fg">{lead}</p>
      {wide && <p className="text-sm text-muted">{t("wideNote")}</p>}
      <div className="flex flex-col gap-tight border-t border-hairline pt-section">
        <p className="text-xs font-medium text-muted">{t("roleHeading")}</p>
        <div className="flex flex-wrap items-center gap-x-tight gap-y-inline">
          <StatusPill tone="neutral">{role?.name ?? tp("profile.noRole")}</StatusPill>
          {role && <span className="min-w-0 break-words text-sm text-fg-secondary">{summarise(role)}</span>}
        </div>
      </div>
    </div>
  );
}

function Venues({
  venues,
  counterCount,
  canSell,
  thisTillId,
  onOpenTill,
}: {
  venues: AssignedVenue[];
  counterCount: number;
  canSell: boolean;
  thisTillId: string;
  onOpenTill: (counterId: string) => void;
}) {
  const t = useTranslations("settings.assignments");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const searching = counterCount > SEARCH_FROM && needle !== "";

  const shown = searching
    ? venues
        .map((v) => ({ ...v, counters: v.counters.filter((c) => c.counter.name.toLocaleLowerCase().includes(needle)) }))
        .filter((v) => v.counters.length > 0)
    : venues;

  return (
    <>
      {counterCount > SEARCH_FROM && (
        <SearchField value={query} onChange={setQuery} label={t("searchLabel")} placeholder={t("searchPlaceholder")} />
      )}
      {searching && shown.length === 0 && (
        <p className="card-surface p-card text-base text-muted" role="status">
          {t("noMatch", { query: query.trim() })}
        </p>
      )}
      {shown.map((v) => (
        <VenueCard
          key={v.location.id}
          venue={v}
          several={venues.length > 1}
          canSell={canSell}
          thisTillId={thisTillId}
          onOpenTill={onOpenTill}
        />
      ))}
    </>
  );
}

function VenueCard({
  venue,
  several,
  canSell,
  thisTillId,
  onOpenTill,
}: {
  venue: AssignedVenue;
  several: boolean;
  canSell: boolean;
  thisTillId: string;
  onOpenTill: (counterId: string) => void;
}) {
  const t = useTranslations("settings.assignments");
  const { location } = venue;
  const address = [location.addressLine1, location.city, location.country].filter(Boolean).join(", ");
  const { method } = useEnumLabels();

  // Seven counters that all sell the same things should not say so seven times.
  // The line moves up to the venue, and a row speaks only when it differs.
  const openOnes = venue.counters.filter((c) => c.open);
  const lines = new Set(openOnes.map((c) => capability(c.counter, t, method)));
  const shared = openOnes.length > 1 && lines.size === 1 ? [...lines][0] : null;

  return (
    <section className="card-surface overflow-hidden">
      <header className="flex flex-col gap-tight p-card sm:flex-row sm:items-start sm:justify-between sm:gap-section">
        <div className="flex min-w-0 items-start gap-comfortable">
          <IconTile icon={MapPin} />
          <div className="min-w-0">
            <h2 className="break-words text-md font-semibold text-fg">{location.name}</h2>
            {address && <p className="mt-inline break-words text-sm text-muted">{address}</p>}
            {shared && <p className="mt-tight break-words text-sm text-fg-secondary">{t("sameCapability", { capability: shared })}</p>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-tight">
          <StatusPill tone="neutral">{venue.source === "direct" ? t("viaDirect") : t("viaWorkspace")}</StatusPill>
          {venue.current && several && <StatusPill tone="info">{t("currentVenue")}</StatusPill>}
        </div>
      </header>

      {venue.counters.length === 0 ? (
        <p className="border-t border-hairline p-card text-sm text-muted">{t("noCounters")}</p>
      ) : (
        <ul aria-label={t("countersAt", { place: location.name })} className="divide-y divide-hairline border-t border-hairline">
          {venue.counters.map((c) => (
            <CounterRow
              key={c.counter.id}
              item={c}
              sharedLine={shared !== null}
              canSell={canSell}
              isThisTill={c.counter.id === thisTillId}
              onOpenTill={onOpenTill}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function CounterRow({
  item,
  sharedLine,
  canSell,
  isThisTill,
  onOpenTill,
}: {
  item: AssignedCounter;
  /** The venue already says what these counters do, so the row need not. */
  sharedLine: boolean;
  canSell: boolean;
  isThisTill: boolean;
  onOpenTill: (counterId: string) => void;
}) {
  const t = useTranslations("settings.assignments");
  const { method } = useEnumLabels();
  const { counter, open } = item;
  const icon: LucideIcon = counter.checkIn === "manual" ? ScanLine : counter.checkIn === "auto" ? Zap : Store;

  return (
    <li className="flex min-h-16 flex-wrap items-center gap-x-comfortable gap-y-tight px-card py-comfortable">
      {/* The button stays on the row while the name has room, and otherwise
          drops to the row's right edge, rather than squeezing a long name. */}
      <div className={`flex min-w-0 grow basis-48 gap-comfortable ${open && sharedLine ? "items-center" : "items-start"}`}>
        <IconTile icon={icon} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-tight gap-y-inline">
            <h3 className="break-words text-base font-medium text-fg">{counter.name}</h3>
            {counter.checkIn && <StatusPill tone="neutral">{counter.checkIn === "auto" ? t("checkInAuto") : t("checkIn")}</StatusPill>}
            {isThisTill && <StatusPill tone="info">{t("thisTill")}</StatusPill>}
            {!open && <StatusPill tone="warning">{t("closed")}</StatusPill>}
          </div>
          {!open ? (
            <p className="mt-inline break-words text-sm text-muted">{t("closedNote")}</p>
          ) : sharedLine ? null : (
            <p className="mt-inline break-words text-sm text-muted">{capability(counter, t, method)}</p>
          )}
        </div>
      </div>
      {open && canSell && (
        <Button variant="tertiary" size="sm" className="ml-auto" onClick={() => onOpenTill(counter.id)} aria-label={t("openTillAt", { counter: counter.name })}>
          {t("openTill")}
          <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden />
        </Button>
      )}
    </li>
  );
}

/** What the counter sells and how it takes payment, in words. */
function capability(
  counter: Counter,
  t: ReturnType<typeof useTranslations>,
  method: (v: string) => string,
): string {
  const sells =
    counter.allowedProductIds === "all" ? t("sellsAll") : t("sellsSome", { count: counter.allowedProductIds.length });
  const pays = counter.allowedPaymentMethods.map(method).join(", ");
  return pays ? `${sells} · ${pays}` : sells;
}

function DeviceRow({ device, meId, venues }: { device: Device; meId: string; venues: AssignedVenue[] }) {
  const t = useTranslations("settings.assignments");
  const counter = venues.flatMap((v) => v.counters).find((c) => c.counter.id === device.counterId)?.counter.name;
  const assigned = device.staffIds?.includes(meId);
  const how =
    device.ownerStaffId === meId
      ? t("deviceYours")
      : assigned
        ? counter
          ? t("deviceAssignedAt", { counter })
          : t("deviceAssigned")
        : counter
          ? t("deviceAnyoneAt", { counter })
          : t("deviceAnyone");
  return (
    <div className="flex items-center gap-comfortable px-card py-comfortable">
      <IconTile icon={device.ownerStaffId ? Smartphone : Tablet} />
      <div className="min-w-0">
        <p className="break-words text-base font-medium text-fg">{device.name}</p>
        <p className="text-sm text-muted">{how}</p>
      </div>
    </div>
  );
}

/** Who changes it: yourself in Team if you can, otherwise the managers to ask. */
function ChangeSection({
  canManageTeam,
  managers,
  teamHref,
}: {
  canManageTeam: boolean;
  managers: Staff[];
  teamHref: string;
}) {
  const t = useTranslations("settings.assignments");
  if (canManageTeam) {
    return (
      <SettingsSection title={t("changeTitle")}>
        <SettingRow label={t("changeSelf")} description={t("changeSelfDesc")} trailing labelFor={false}>
          {() => <ButtonLink href={teamHref}>{t("editInTeam")}</ButtonLink>}
        </SettingRow>
      </SettingsSection>
    );
  }
  return (
    <SettingsSection title={t("changeTitle")} description={t("changeManagers")} divided>
      {managers.length === 0 ? (
        <p className="px-card pb-card text-base text-fg">{t("noManagers")}</p>
      ) : (
        managers.map((m) => <ManagerRow key={m.id} manager={m} />)
      )}
    </SettingsSection>
  );
}

function ManagerRow({ manager }: { manager: Staff }) {
  const t = useTranslations("settings.assignments");
  const contact = manager.email
    ? { href: `mailto:${manager.email}`, text: manager.email, label: t("emailManager", { name: manager.name }) }
    : manager.phone
      ? { href: `tel:${manager.phone}`, text: manager.phone, label: t("callManager", { name: manager.name }) }
      : null;
  return (
    <div className="flex flex-wrap items-center gap-x-comfortable gap-y-inline px-card py-comfortable">
      <Avatar name={manager.name} size={36} soft />
      <div className="min-w-0 grow basis-40">
        <p className="break-words text-base font-medium text-fg">{manager.name}</p>
        {contact && (
          <a
            href={contact.href}
            aria-label={contact.label}
            className="inline-flex min-h-11 max-w-full items-center break-all text-sm text-brand-foreground underline underline-offset-4 hover:no-underline md:min-h-0"
          >
            {contact.text}
          </a>
        )}
      </div>
    </div>
  );
}
