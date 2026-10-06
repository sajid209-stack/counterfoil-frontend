"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Role, Staff } from "@/lib/api";
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
 * Who can sign in on this tablet.
 *
 * One choice, in words — everyone who works here, or only these people — and,
 * only for the second, who. A tablet can also be somebody's own, which is a
 * third thing and not a mode of the second: it lists one person and sends them
 * straight to their PIN pad.
 *
 * Nothing here acts at once. It is part of the device page's draft, so it waits
 * for the same Save bar as the name and the counter, and Discard puts it back.
 */
export function DeviceAccess({
  value,
  onChange,
  staff,
  roles,
  place,
  counterName,
  error,
}: {
  value: AccessDraft;
  onChange: (next: AccessDraft) => void;
  staff: Staff[];
  roles: Role[];
  /** The venue the tablet's counter is in. */
  place: string;
  counterName: string;
  error?: string;
}) {
  const t = useTranslations("settings");
  const groupName = useId();
  const [q, setQ] = useState("");

  const owner = value.ownerStaffId;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "";

  // Everyone who can be picked: people who can sign in, plus anyone already on
  // the list who no longer can, so they can be taken off rather than lingering.
  const pickable = useMemo(
    () =>
      staff
        .filter((s) => s.status === "active" || value.staffIds.includes(s.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [staff, value.staffIds],
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
    <SettingsSection title={t("devices.accessTitle")} description={t("devices.accessDesc")}>
      <div
        role="radiogroup"
        aria-label={t("devices.accessGroup")}
        aria-disabled={!!owner || undefined}
        className={cn("flex flex-col gap-tight px-card py-section", owner && "opacity-60")}
      >
        {options.map((o) => {
          const checked = owner ? o.v === "assigned" : value.access === o.v;
          return (
            <label
              key={o.v}
              className={cn(
                "flex items-start gap-comfortable rounded-md border p-comfortable transition-colors duration-quick",
                owner ? "cursor-not-allowed" : "cursor-pointer",
                checked ? "border-ember-solid bg-ember/5" : cn("border-line", !owner && "hover:bg-muted-wash"),
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.v}
                checked={checked}
                disabled={!!owner}
                onChange={() => setMode(o.v)}
                className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{o.label}</span>
                <span className="mt-inline block text-[13px] leading-relaxed text-muted">{o.note}</span>
              </span>
            </label>
          );
        })}
      </div>

      {picking && (
        <div className="px-card py-section">
          <div className="flex flex-wrap items-center justify-between gap-tight">
            <p id={`${groupName}-label`} className="text-sm font-medium text-fg">
              {t("devices.pickLabel")}
            </p>
            <p aria-live="polite" className="text-[13px] text-muted">
              {t("devices.pickCount", { count: value.staffIds.length })}
            </p>
          </div>
          {pickable.length === 0 ? (
            <p className="mt-tight text-sm text-muted">{t("devices.pickNoPeople")}</p>
          ) : (
            <>
              {pickable.length > SEARCH_FROM && (
                <div className="mt-tight">
                  <SearchField value={q} onChange={setQ} label={t("devices.pickSearch")} placeholder={t("devices.pickSearch")} />
                </div>
              )}
              <ul aria-labelledby={`${groupName}-label`} className="mt-tight divide-y divide-hairline overflow-hidden rounded-md border border-line">
                {shown.map((s) => {
                  const on = value.staffIds.includes(s.id);
                  const blocked = s.status !== "active";
                  return (
                    <li key={s.id}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-comfortable px-comfortable py-tight transition-colors duration-quick hover:bg-muted-wash">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4 shrink-0 accent-ember"
                        />
                        <Avatar name={s.name} size={36} soft />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
                          <span className="block truncate text-[13px] text-muted">
                            {roleName(s.roleId)}
                            {blocked ? ` · ${t("team.tab.suspended")}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="px-comfortable py-section text-sm text-muted">{t("devices.pickEmpty")}</li>}
              </ul>
            </>
          )}
          {error && (
            <p role="alert" className="mt-tight text-[12px] text-danger">
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
                  .filter((s) => s.status === "active")
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => ({ value: s.id, label: s.name, note: roleName(s.roleId) })),
              ]}
            />
            {ownerPerson && (
              <p className="mt-tight text-[13px] text-muted">{t("devices.ownerSummary", { name: firstName(ownerPerson) })}</p>
            )}
          </>
        )}
      </SettingRow>
    </SettingsSection>
  );
}
