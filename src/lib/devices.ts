const DAY = 86_400_000;

const shiftDay = (ymd: string, days: number) =>
  new Date(Date.parse(`${ymd}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/**
 * A device that has not checked in for a week — or never has.
 *
 * One rule, read by the dashboard's "device has gone quiet" notice and by the
 * settings index, so the two can never disagree about which devices those are.
 * It lived inline on the dashboard until a second screen needed it.
 */
export function isDeviceQuiet(device: { lastSeenAt: string | null }, today: string): boolean {
  return !device.lastSeenAt || device.lastSeenAt.slice(0, 10) <= shiftDay(today, -7);
}
