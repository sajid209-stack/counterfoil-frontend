"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Avatar, Checkbox, Radio, Select, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { hasTillPin, peopleAllowedOn, type Device, type Role, type Staff } from "@/lib/api";
import { SearchField, SettingRow, SettingsSection } from "../../_components/SettingsKit";
import { firstName } from "./WhoStack";

export interface AccessDraft {
  access: "venue" | "assigned";
  staffIds: string[];
  /** "" when it is a shared tablet. */
  ownerStaffId: string;
}

/** What is wrong with a draft, as a key the page translates — or null. */
export function accessProblem(
  a: AccessDraft,
  staff: Staff[],
): { key: "pickErr" } | { key: "pickBlocked"; name: string } | null {
  if (a.ownerStaffId || a.access !== "assigned") return null;
  if (a.staffIds.length === 0) return { key: "pickErr" };
  const blocked = a.staffIds.map((id) => staff.find((s) => s.id === id)).find((s) => s && s.status !== "active");
  return blocked ? { key: "pickBlocked", name: blocked.name } : null;
}

/** Past this many people the list gets a search box; below it, you just read it. */
const SEARCH_FROM = 8;

/**
 * "No till PIN — can't sign in", with a way to fix it. A person without a PIN
 * can be allowed on a tablet, but the tablet's sign-in will not list them, so
 * the chip says it at the moment somebody is being chosen, not afterwards.
 */
export function NoPinChip({ className }: { className?: string }) {
  const t = useTranslations("settings");
  return (
    <span data-testid="no-pin-chip" className={cn("inline-flex", className)}>
      <StatusPill tone="warning">{t("devices.noPinChip")}</StatusPill>
    </span>
  );
}

/** The link beside a person without a PIN: their team page has "Set a PIN". */
export function SetPinLink({ person }: { person: Pick<Staff, "id" | "name"> }) {
  const t = useTranslations("settings");
  return (
    <Link
      href={`/settings/team/${person.id}`}
      aria-label={t("devices.setPinFor", { name: person.name })}
      className="inline-flex min-h-11 shrink-0 items-center px-tight text-sm font-medium text-brand-foreground underline underline-offset-2 hover:opacity-80"
    >
      {t("devices.setPin")}
    </Link>
  );
}

/**
 * The live answer to "who can actually sign in?" for a tablet as it is being
 * set up — "3 people can sign in on it", or the refusal in words. Said again
 * under the people, because the list above shows who is ALLOWED and this says
 * who will actually be able to.
 */
export function SignInSummary({
  device,
  staff,
  showRefusal = true,
}: {
  /** The tablet as drafted: its counter and who it is open to. */
  device: Device;
  staff: Staff[];
  /** False before the manager has had a chance to choose. */
  showRefusal?: boolean;
}) {
  const t = useTranslations("settings");
  const allowed = peopleAllowedOn(device, staff);
  const can = allowed.filter(hasTillPin);
  const noPin = allowed.filter((s) => !hasTillPin(s));
  const none = can.length === 0;
  return (
    <div aria-live="polite" data-testid="signin-summary" data-count={can.length} className="flex flex-col gap-inline">
      {none ? (
        showRefusal && (
          <p className="text-base font-medium text-danger">
            {device.counterId ? t("devices.signInNone") : t("devices.signInNoneNoCounter")}
          </p>
        )
      ) : (
        <p className="flex items-center gap-tight text-base font-medium text-success">
          <Check aria-hidden size={16} strokeWidth={2.25} />
          {t("devices.signInCount", { count: can.length })}
        </p>
      )}
      {noPin.length > 0 && <p className="text-sm text-warning">{t("devices.signInNoPin", { count: noPin.length })}</p>}
    </div>
  );
}

/**
 * The fields of "who can sign in" — the choice, the people, the own-device
 * picker — without a card around them, so the device page can put them in its
 * own section and the Add-device page in a numbered one.
 *
 * One choice, in words — everyone who works here, or only these people — and,
 * only for the second, who. A tablet can also be somebody's own, which is a
 * third thing and not a mode of the second: it lists one person and sends them
 * straight to their PIN pad.
 *
 * Nothing here acts at once. It is part of the page's draft, so it waits for the
 * same Save (or Add) as the rest, and Discard puts it back.
 */
export function AccessFields({
  value,
  onChange,
  staff,
  roles,
  place,
  counterName,
  error,
  scope,
}: {
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  staff: Staff[];
  roles: Role[];
  /** The venue the tablet's counter is in. */
  place: string;
  counterName: string;
  error?: string;
  /**
   * Narrow the people list to one venue. "pending" = no counter chosen yet, so
   * nobody can be listed. Omitted = everyone (how the device page has always
   * worked: a museum cashier covering a fort shift can be added).
   */
  scope?: { venueId: string; venueName: string } | "pending";
}) {
  const t = useTranslations("settings");
  const groupName = useId();
  const [q, setQ] = useState("");
  const [others, setOthers] = useState(false);

  const owner = value.ownerStaffId;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "";
  const venueScope = scope && scope !== "pending" ? scope : null;
  const narrowed = !!scope && !others;

  // Everyone who can be picked: people who can sign in (at this venue, until
  // "another venue" is asked for), plus anyone already on the list who no longer
  // qualifies, so they can be taken off rather than lingering.
  const pickable = useMemo(
    () =>
      staff
        .filter((s) => {
          if (value.staffIds.includes(s.id)) return true;
          if (s.status !== "active") return false;
          if (!narrowed) return true;
          return venueScope ? s.locationIds.includes(venueScope.venueId) : false;
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, value.staffIds, narrowed, venueScope],
  );
  const shown = pickable.filter((s) => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase()));
  const ownerPerson = staff.find((s) => s.id === owner);

  const setMode = (access: "venue" | "assigned") => onChange({ ...value, access });
  const toggle = (id: string) =>
    onChange({
      ...value,
      staffIds: value.staffIds.includes(id) ? value.staffIds.filter((x) => x !== id) : [...value.staffIds, id],
    });

  const options = [
    {
      v: "venue" as const,
      label: counterName ? t("devices.accessVenue", { place: place || counterName }) : t("devices.accessVenueNoCounter"),
      note: counterName ? t("devices.accessVenueNote", { counter: counterName }) : t("devices.accessVenueNoCounterNote"),
    },
    { v: "assigned" as const, label: t("devices.accessAssigned"), note: t("devices.accessAssignedNote") },
  ];
  const picking = !owner && value.access === "assigned";

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("devices.accessGroup")}
        aria-disabled={!!owner || undefined}
        className={cn("flex flex-col gap-tight px-card py-section", owner && "opacity-60")}
      >
        {options.map((o) => {
          const checked = owner ? o.v === "assigned" : value.access === o.v;
          return (
            // The tile is the target; the kit Radio inside is the control.
            <div
              key={o.v}
              onClick={(e) => {
                if (owner || (e.target as HTMLElement).closest("label,input")) return;
                setMode(o.v);
              }}
              className={cn(
                "rounded-control px-tight transition-colors duration-quick",
                owner ? "cursor-not-allowed" : "cursor-pointer",
                checked ? "bg-card ring-2 ring-inset ring-ember-solid" : cn("bg-muted-wash", !owner && "hover:ring-1 hover:ring-inset hover:ring-line"),
              )}
            >
              <Radio
                name={groupName}
                value={o.v}
                checked={checked}
                disabled={!!owner}
                onChange={() => setMode(o.v)}
                label={<span className="font-medium">{o.label}</span>}
                description={o.note}
              />
            </div>
          );
        })}
      </div>

      {picking && (
        <div className="px-card py-section" data-field="people" tabIndex={-1}>
          <div className="flex flex-wrap items-center justify-between gap-tight">
            <p id={`${groupName}-label`} className="text-base font-medium text-fg">
              {t("devices.pickLabel")}
            </p>
            <p aria-live="polite" className="text-sm text-muted">
              {t("devices.pickCount", { count: value.staffIds.length })}
            </p>
          </div>
          {venueScope && narrowed && (
            <p className="mt-inline text-sm text-muted">{t("devices.pickVenueNote", { place: venueScope.venueName })}</p>
          )}
          {scope === "pending" ? (
            <p className="mt-tight text-base text-muted">{t("devices.pickCounterFirst")}</p>
          ) : pickable.length === 0 ? (
            <p className="mt-tight text-base text-muted">{t("devices.pickNoPeople")}</p>
          ) : (
            <>
              {pickable.length > SEARCH_FROM && (
                <div className="mt-tight">
                  <SearchField value={q} onChange={setQ} label={t("devices.pickSearch")} placeholder={t("devices.pickSearch")} />
                </div>
              )}
              <ul aria-labelledby={`${groupName}-label`} className="mt-tight divide-y divide-hairline overflow-hidden rounded-control border border-line">
                {shown.map((s) => {
                  const on = value.staffIds.includes(s.id);
                  const blocked = s.status !== "active";
                  const noPin = !hasTillPin(s);
                  return (
                    <li key={s.id} data-person={s.id} className="flex items-center gap-tight pl-tight transition-colors duration-quick hover:bg-muted-wash">
                      <Checkbox id={`${groupName}-${s.id}`} checked={on} onChange={() => toggle(s.id)} />
                      <label htmlFor={`${groupName}-${s.id}`} className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-comfortable pr-comfortable py-tight">
                        <Avatar name={s.name} size={36} soft />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium text-fg">{s.name}</span>
                          <span className="block truncate text-sm text-muted">
                            {roleName(s.roleId)}
                            {blocked ? ` · ${t("team.tab.suspended")}` : ""}
                          </span>
                          {noPin && !blocked && <NoPinChip className="mt-inline" />}
                        </span>
                      </label>
                      {noPin && !blocked && (
                        <span className="pr-comfortable">
                          <SetPinLink person={s} />
                        </span>
                      )}
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="px-comfortable py-section text-base text-muted">{t("devices.pickEmpty")}</li>}
              </ul>
              {venueScope && (
                <button
                  type="button"
                  onClick={() => setOthers((v) => !v)}
                  className="mt-tight inline-flex min-h-11 items-center text-sm font-medium text-brand-foreground underline underline-offset-2 hover:opacity-80"
                >
                  {others ? t("devices.pickOnlyVenue", { place: venueScope.venueName }) : t("devices.pickOthers")}
                </button>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="mt-tight text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      <SettingRow label={t("devices.ownerLabel")} description={t("devices.ownerDesc")}>
        {({ id, describedBy }) => (
          <>
            <Select
              id={id}
              aria-describedby={describedBy}
              value={owner}
              onChange={(ownerStaffId) =>
                onChange({
                  ...value,
                  ownerStaffId,
                  access: "assigned",
                  staffIds: ownerStaffId ? [ownerStaffId] : value.staffIds,
                })
              }
              options={[
                { value: "", label: t("devices.ownerNone") },
                ...staff
                  .filter((s) => s.status === "active" && (!venueScope || !narrowed || s.locationIds.includes(venueScope.venueId)))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => ({ value: s.id, label: s.name, note: roleName(s.roleId) })),
              ]}
            />
            {ownerPerson && (
              <p className="mt-tight text-sm text-muted">{t("devices.ownerSummary", { name: firstName(ownerPerson) })}</p>
            )}
            {ownerPerson && !hasTillPin(ownerPerson) && (
              <p className="mt-tight flex flex-wrap items-center gap-x-tight">
                <NoPinChip />
                <SetPinLink person={ownerPerson} />
              </p>
            )}
          </>
        )}
      </SettingRow>
    </>
  );
}

/** The device page's section: the same fields in a titled card. */
export function DeviceAccess(props: React.ComponentProps<typeof AccessFields> & { summary?: React.ReactNode }) {
  const t = useTranslations("settings");
  const { summary, ...rest } = props;
  return (
    <SettingsSection title={t("devices.accessTitle")} description={t("devices.accessDesc")}>
      <AccessFields {...rest} />
      {summary && <div className="px-card py-section">{summary}</div>}
    </SettingsSection>
  );
}
