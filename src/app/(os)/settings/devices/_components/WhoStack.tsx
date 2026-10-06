"use client";

import { useTranslations } from "next-intl";
import { deviceAccess, type Counter, type Device, type Location, type Staff } from "@/lib/api";

export const firstName = (s: Pick<Staff, "name">) => s.name.trim().split(/\s+/)[0] ?? s.name;

/** Who a device is open to, resolved against the people and places that exist. */
export function resolveWho(device: Device, staff: Staff[], counters: Counter[], locations: Location[]) {
  const counter = counters.find((c) => c.id === device.counterId);
  const venue = locations.find((l) => l.id === counter?.locationId);
  const place = venue?.name ?? counter?.name ?? "";
  if (device.ownerStaffId) {
    const owner = staff.find((s) => s.id === device.ownerStaffId);
    return { kind: "own" as const, people: owner ? [owner] : [], place, counter };
  }
  if (deviceAccess(device) === "assigned") {
    const people = (device.staffIds ?? []).map((id) => staff.find((s) => s.id === id)).filter((s): s is Staff => !!s);
    return { kind: people.length ? ("people" as const) : ("nobody" as const), people, place, counter };
  }
  return { kind: "everyone" as const, people: [] as Staff[], place, counter };
}

/**
 * "Nadia, Rafi +2" or "Everyone at Lalbagh Fort", with up to three faces in
 * front of it. The words carry the meaning; the faces are for finding yourself.
 */
export function WhoStack({
  device,
  staff,
  counters,
  locations,
}: {
  device: Device;
  staff: Staff[];
  counters: Counter[];
  locations: Location[];
}) {
  const t = useTranslations("settings");
  const who = resolveWho(device, staff, counters, locations);
  let text: string;
  if (who.kind === "own") text = t("devices.whoOwn", { name: who.people[0] ? firstName(who.people[0]) : "—" });
  else if (who.kind === "nobody") text = t("devices.whoNobody");
  else if (who.kind === "everyone") text = who.counter ? t("devices.whoEveryone", { place: who.place }) : t("devices.accessVenueNoCounter");
  else {
    const shown = who.people.slice(0, 2).map(firstName).join(", ");
    const more = who.people.length - 2;
    text = more > 0 ? `${shown} +${more}` : shown;
  }
  const faces = who.people.slice(0, 3);
  return (
    <span className="flex items-center gap-tight" data-who={who.kind}>
      {faces.length > 0 && (
        <span aria-hidden className="flex -space-x-2">
          {faces.map((s) => (
            <span
              key={s.id}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle text-[12px] font-semibold leading-none text-fg ring-2 ring-card"
            >
              {firstName(s).charAt(0).toUpperCase()}
            </span>
          ))}
        </span>
      )}
      <span className={who.kind === "nobody" ? "text-warning" : undefined}>{text}</span>
    </span>
  );
}
