import type { Counter, Device, Location, Role, Staff } from "@/lib/api";
import { devicesForStaff } from "@/lib/api/devices";

/**
 * Where a person works, worked out once.
 *
 * Answers the four things someone opens this page to find out: where can I
 * work, what can I do there, what do I sign in on, and who changes it if it is
 * wrong. Pure, so the page draws what it is given and the rules can be checked
 * without a browser. When the backend arrives, this keeps its shape and only
 * what feeds it changes.
 *
 * A venue is where someone can sign in; a counter is where they can sell (the
 * Team editor's own definition, in WorkplacePicker).
 */

/** How a person came to have a venue: named on it, or through the workspace. */
export type AccessSource = "direct" | "workspace";

export interface AssignedCounter {
  counter: Counter;
  /** Not closed in Settings, so a till can use it now. */
  open: boolean;
}

export interface AssignedVenue {
  location: Location;
  source: AccessSource;
  /** The venue the OS bar is currently on. */
  current: boolean;
  counters: AssignedCounter[];
}

export interface Assignments {
  venues: AssignedVenue[];
  counterCount: number;
  openCounterCount: number;
  /** The role lets them use a till at all. */
  canSell: boolean;
  /** They can change assignments themselves, in Team. */
  canManageTeam: boolean;
  /** They have somewhere to sell and nothing to sign in to a till with. */
  needsPin: boolean;
  devices: Device[];
  /** Who to ask, nearest first. Empty when the person can do it themselves. */
  managers: Staff[];
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const MANAGERS_SHOWN = 3;

export function buildAssignments({
  me,
  role,
  roles,
  staff,
  locations,
  counters,
  devices,
  currentLocationId,
}: {
  me: Staff;
  role: Role | undefined;
  roles: Role[];
  staff: Staff[];
  locations: Location[];
  counters: Counter[];
  devices: Device[];
  currentLocationId?: string;
}): Assignments {
  const liveCounters = counters.filter((c) => c.status !== "archived");
  const liveLocations = locations.filter((l) => l.status !== "archived");
  const wide = me.workspaceWide === true;

  const mine = wide ? liveCounters : liveCounters.filter((c) => me.counterIds.includes(c.id));
  // A counter's venue is listed even if the venue itself was never ticked: a
  // counter nobody can see is a counter nobody can correct.
  const venueIds = new Set(wide ? liveLocations.map((l) => l.id) : [...me.locationIds, ...mine.map((c) => c.locationId)]);

  const venues: AssignedVenue[] = liveLocations
    .filter((l) => venueIds.has(l.id))
    .map((location) => ({
      location,
      source: wide ? ("workspace" as const) : ("direct" as const),
      current: location.id === currentLocationId,
      counters: mine
        .filter((c) => c.locationId === location.id)
        .map((counter) => ({ counter, open: counter.status === "active" }))
        // Somewhere you can work right now reads before somewhere you cannot.
        .sort((a, b) => Number(b.open) - Number(a.open) || byName(a.counter, b.counter)),
    }))
    .sort((a, b) => Number(b.current) - Number(a.current) || byName(a.location, b.location));

  const shown = venues.flatMap((v) => v.counters);
  const canSell = !!role?.permissions.includes("pos.sell");
  const canManageTeam = !!role?.permissions.includes("staff.manage");

  const canManage = (s: Staff) => !!roles.find((r) => r.id === s.roleId)?.permissions.includes("staff.manage");
  const sharesVenue = (s: Staff) => s.workspaceWide === true || s.locationIds.some((id) => venueIds.has(id));
  const managers = canManageTeam
    ? []
    : staff
        .filter((s) => s.id !== me.id && s.status === "active" && canManage(s))
        .sort((a, b) => Number(sharesVenue(b)) - Number(sharesVenue(a)) || byName(a, b))
        .slice(0, MANAGERS_SHOWN);

  const { owned, assigned, open } = devicesForStaff(devices, me);

  return {
    venues,
    counterCount: shown.length,
    openCounterCount: shown.filter((c) => c.open).length,
    canSell,
    canManageTeam,
    needsPin: canSell && shown.length > 0 && me.hasPin !== true,
    devices: [...owned, ...assigned, ...open],
    managers,
  };
}
