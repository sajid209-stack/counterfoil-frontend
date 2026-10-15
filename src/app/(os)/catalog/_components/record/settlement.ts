/**
 * The sales summary an on-a-date booking can be downloaded as: per ticket type,
 * per day and by where it was bought. It is the one piece of the old event
 * record that is meaningful for events only (capacity, unsold, face value), so
 * it is a download in the menu, never a different layout.
 */
import type { EventRecord, EventSettlement } from "@/lib/api";

/** The settlement as a CSV an accountant can open: the ticket types, the days and where it was bought. */
export function settlementCsv(
  e: EventRecord,
  s: EventSettlement,
  tr: (key: string, values?: Record<string, string | number>) => string,
): string {
  const major = (m: number) => (m / 100).toFixed(2);
  const cell = (v: string | number) => {
    const t = String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const row = (xs: (string | number)[]) => xs.map(cell).join(",");
  const lines = [
    row([tr("colTicket"), tr("colPrice"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol"), tr("settle.faceValue"), tr("settle.refundedCol"), tr("settle.taken")]),
    ...s.tiers.map((x) => row([x.name, major(x.price), x.capacity, x.sold, x.unsold, major(x.faceValue), major(x.refundedAmount), major(x.net)])),
    row([tr("settle.total"), "", s.totals.capacity, s.totals.sold, s.totals.unsold, major(s.totals.faceValue), major(s.totals.refundedAmount), major(s.totals.net)]),
  ];
  if (s.days.length > 1) {
    lines.push("", row([tr("settle.byDay"), tr("settle.capacity"), tr("settle.sold"), tr("settle.unsoldCol")]));
    for (const d of s.days) lines.push(row([`${d.name} ${d.date}`, d.capacity, d.sold, d.unsold]));
  }
  if (s.byChannel.length) {
    lines.push("", row([tr("settle.byChannel"), tr("settle.sold"), tr("settle.taken")]));
    for (const c of s.byChannel) lines.push(row([tr(`settle.channel.${c.channel}`), c.sold, major(c.net)]));
  }
  return lines.join("\n");
}

/** Hand a CSV to the browser as a download. */
export function downloadCsv(name: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
