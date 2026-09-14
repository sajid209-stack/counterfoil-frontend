/** The time zones offered wherever a clock is chosen in Settings. */
export const TIMEZONES = ["Asia/Dhaka", "Asia/Kuala_Lumpur", "America/New_York", "America/Toronto"];

/** "Asia/Dhaka (GMT+6)" — the offset is what an operator actually checks. */
export function zoneLabel(zone: string): string {
  try {
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${zone.replace(/_/g, " ")} (${offset})` : zone;
  } catch {
    return zone;
  }
}
