/**
 * Whether a venue is open right now, said honestly.
 *
 * "Open today" is true at 9pm for a venue that closed at 6pm, so the page says
 * what a visitor needs: open now and until when, closed now and when it opens
 * next. Read against the page's own clock (`now`), the same one the booking
 * pages use for "a time that has passed cannot be chosen".
 */
import type { OpeningHours } from "@/lib/api/types";

export type OpenStatus =
  | { kind: "open"; until: string }
  | { kind: "later"; at: string }
  | { kind: "next"; dayOffset: number; dayOfWeek: number; at: string }
  | { kind: "closed" };

const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function openStatus(hours: OpeningHours[], now: Date): OpenStatus {
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rowOf = (d: number) => hours.find((h) => h.dayOfWeek === d);
  const sorted = (d: number) => [...(rowOf(d)?.intervals ?? [])].sort((a, b) => mins(a.opensAt) - mins(b.opensAt));

  const today = sorted(dow);
  for (const iv of today) {
    if (nowMin >= mins(iv.opensAt) && nowMin < mins(iv.closesAt)) return { kind: "open", until: iv.closesAt };
  }
  const later = today.find((iv) => mins(iv.opensAt) > nowMin);
  if (later) return { kind: "later", at: later.opensAt };

  for (let i = 1; i <= 7; i++) {
    const d = (dow + i) % 7;
    const first = sorted(d)[0];
    if (first) return { kind: "next", dayOffset: i, dayOfWeek: d, at: first.opensAt };
  }
  return { kind: "closed" };
}
