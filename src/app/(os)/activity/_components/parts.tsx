"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Ban,
  CalendarClock,
  DoorClosed,
  DoorOpen,
  Hand,
  LogIn,
  LogOut,
  Lock,
  Percent,
  Power,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Settings2,
  ShieldAlert,
  Tablet,
  TicketCheck,
  TicketX,
  Undo2,
  Unlock,
  UserPlus,
  CircleCheck,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatClock, formatClockOf, formatDateTime, formatDay, formatMoney } from "@/lib/format";
import { activityNow, localDay, type ActivityEvent, type ActivityGroup, type ActivityKind, type ActivitySeverity } from "@/lib/api";

/** One glyph per kind, so a row never depends on colour alone: shape, colour and
 *  words all say what happened. */
export const ACTIVITY_ICON: Record<ActivityKind, LucideIcon> = {
  "staff.signed_in": LogIn,
  "staff.signed_out": LogOut,
  "staff.wrong_pin": ShieldAlert,
  "staff.locked_out": Lock,
  "shift.opened": DoorOpen,
  "shift.closed": DoorClosed,
  "ticket.admitted": TicketCheck,
  "ticket.refused": TicketX,
  "ticket.reissued": RefreshCw,
  "ticket.terminated": Ban,
  "refund.requested": RotateCcw,
  "refund.approved": CircleCheck,
  "refund.declined": CircleX,
  "order.refunded": RotateCcw,
  "order.undone": Undo2,
  "order.discount_over_limit": Percent,
  "booking.moved": CalendarClock,
  "hold.placed": Hand,
  "hold.released": Unlock,
  "device.paired": Tablet,
  "device.off": Power,
  "settings.changed": Settings2,
  "team.invited": UserPlus,
};

export const GROUP_ICON: Record<ActivityGroup, LucideIcon> = {
  sessions: LogIn,
  gate: ScanLine,
  sales: RotateCcw,
  bookings: CalendarClock,
  devices: Tablet,
  settings: Settings2,
};

/** Quiet for information; amber and red only when somebody should look. */
export const SEVERITY_ICON_CLASS: Record<ActivitySeverity, string> = {
  info: "text-muted",
  warning: "text-warning",
  critical: "text-danger",
};
/** The faint tint a warning or serious row carries. Never the only carrier. */
export const SEVERITY_ROW_CLASS: Record<ActivitySeverity, string> = {
  info: "",
  warning: "bg-warning/[0.06]",
  critical: "bg-danger/[0.06]",
};

/** "staff.signed_in" -> "staffSignedIn" - message keys cannot carry a dot. */
const camel = (kind: string) => kind.replace(/[._]([a-z])/g, (_, c: string) => c.toUpperCase());

const SETTING_KEYS = ["tax", "payment_methods", "pin_attempts", "opening_hours"];
const MONEY_KEYS = new Set(["amount", "float", "expected", "counted", "difference"]);
const PERCENT_KEYS = new Set(["percent", "limit"]);

type Translator = {
  (key: string, values?: Record<string, unknown>): string;
  rich: (key: string, values: Record<string, unknown>) => React.ReactNode;
};

/** A rich-text result as plain text, for CSV and search. */
function flatten(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  return "";
}

export interface ActivityDetail {
  label: string;
  value: string;
  href?: string | null;
  mono?: boolean;
}

/**
 * Everything the log says in words, from one place: the dashboard card, the
 * full page and the CSV all read this, so a sentence cannot differ between them.
 */
export function useActivityText() {
  const t = useTranslations("activity") as unknown as Translator;

  const actorName = useCallback((e: ActivityEvent) => e.actor?.name ?? t("system"), [t]);
  const place = useCallback((e: ActivityEvent) => e.counter ?? e.venue ?? e.device ?? t("somewhere"), [t]);

  /** Which sentence, and the words that go in it. */
  const describe = useCallback(
    (e: ActivityEvent): { key: string; values: Record<string, string | number> } => {
      const actor = actorName(e);
      const common = { actor, place: place(e), label: e.subject?.label ?? "" };
      const d = e.data;
      const num = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : 0);
      const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
      switch (e.kind) {
        case "staff.signed_in":
          return { key: "staffSignedIn", values: common };
        case "staff.signed_out":
          return { key: "staffSignedOut", values: common };
        case "staff.wrong_pin":
          return { key: "staffWrongPin", values: { ...common, attempt: num("attempt") || 1, max: num("max") || 3 } };
        case "staff.locked_out":
          return { key: "staffLockedOut", values: { ...common, max: num("max") || 3 } };
        case "shift.opened":
          return { key: "shiftOpened", values: { ...common, amount: formatMoney(num("float")) } };
        case "shift.closed": {
          const diff = num("difference");
          if (diff === 0) return { key: "shiftClosedMatched", values: common };
          return { key: diff < 0 ? "shiftClosedShort" : "shiftClosedOver", values: { ...common, amount: formatMoney(Math.abs(diff)) } };
        }
        case "ticket.admitted": {
          const count = num("admitted");
          return count > 1 ? { key: "ticketAdmittedMany", values: { ...common, count } } : { key: "ticketAdmitted", values: common };
        }
        case "ticket.refused": {
          const reason = str("reason");
          if (reason === "already_redeemed") {
            const used = str("usedAt");
            if (used) {
              return localDay(used) === localDay(e.at)
                ? { key: "refusedAlreadyToday", values: { ...common, time: formatClockOf(used) } }
                : { key: "refusedAlreadyBefore", values: { ...common, date: formatDateTime(used) } };
            }
            return { key: "refusedAlready", values: common };
          }
          if (reason === "replaced") return { key: "refusedReplaced", values: common };
          if (reason === "terminated") return { key: "refusedTerminated", values: common };
          if (reason === "void") return { key: "refusedVoid", values: common };
          if (reason === "unpaid") return { key: "refusedUnpaid", values: common };
          const code = str("code");
          return code ? { key: "refusedUnknownCode", values: { ...common, code } } : { key: "refusedUnknown", values: common };
        }
        case "ticket.reissued":
          return { key: "ticketReissued", values: common };
        case "ticket.terminated":
          return { key: "ticketTerminated", values: common };
        case "refund.requested":
          return { key: "refundRequested", values: { ...common, amount: formatMoney(num("amount")) } };
        case "refund.approved":
          return { key: "refundApproved", values: { ...common, amount: formatMoney(num("amount")) } };
        case "refund.declined":
          return { key: "refundDeclined", values: common };
        case "order.refunded":
          return { key: "orderRefunded", values: common };
        case "order.undone":
          return { key: "orderUndone", values: common };
        case "order.discount_over_limit":
          return { key: "discountOver", values: { ...common, percent: num("percent"), limit: num("limit") } };
        case "booking.moved":
          return { key: "bookingMoved", values: { ...common, from: formatClock(str("from")), to: formatClock(str("to")) } };
        case "hold.placed":
          return { key: "holdPlaced", values: { ...common, heldFor: str("heldFor") } };
        case "hold.released":
          return { key: "holdReleased", values: common };
        case "device.paired":
          return { key: "devicePaired", values: common };
        case "device.off":
          return { key: "deviceOff", values: common };
        case "settings.changed": {
          const s = str("setting");
          return { key: "settingsChanged", values: { ...common, setting: SETTING_KEYS.includes(s) ? t(`setting.${s}`) : s } };
        }
        case "team.invited":
          return { key: "teamInvited", values: common };
      }
    },
    [actorName, place, t],
  );

  /**
   * The sentence. `links` turns the subject into a link to its page (the full
   * page); without it the subject is just emphasised (the dashboard card, where
   * the whole row is already a small target).
   */
  const sentence = useCallback(
    (e: ActivityEvent, links = false): React.ReactNode => {
      const { key, values } = describe(e);
      return t.rich(`sentence.${key}`, {
        ...values,
        b: (c: React.ReactNode) => <b className="font-semibold text-fg">{c}</b>,
        s: (c: React.ReactNode) =>
          links && e.subject?.href ? (
            <Link href={e.subject.href} className="font-medium text-fg underline decoration-line underline-offset-2 hover:decoration-fg">
              {c}
            </Link>
          ) : (
            <span className="font-medium text-fg">{c}</span>
          ),
      });
    },
    [describe, t],
  );

  const plain = useCallback(
    (e: ActivityEvent): string => {
      const { key, values } = describe(e);
      return flatten(t.rich(`sentence.${key}`, { ...values, b: (c: React.ReactNode) => c, s: (c: React.ReactNode) => c }));
    },
    [describe, t],
  );

  const kindLabel = useCallback((e: ActivityEvent) => t(`kind.${camel(e.kind)}`), [t]);
  const severityLabel = useCallback((s: ActivitySeverity) => t(`severity.${s}`), [t]);
  const groupLabel = useCallback((g: ActivityGroup) => t(`group.${g}`), [t]);
  /** "venue · counter · device", whatever of those the event has. */
  const where = useCallback((e: ActivityEvent) => [e.venue, e.counter, e.device].filter(Boolean).join(" · "), []);

  /** "12 min ago", measured from the demo's moving clock. */
  const ago = useCallback(
    (iso: string) => {
      const mins = Math.max(0, Math.round((activityNow().getTime() - Date.parse(iso)) / 60000));
      if (mins < 1) return t("ago.justNow");
      if (mins < 60) return t("ago.min", { count: mins });
      if (mins < 1440) return t("ago.hr", { count: Math.round(mins / 60) });
      return t("ago.day", { count: Math.round(mins / 1440) });
    },
    [t],
  );

  /** The facts an expanded row shows, labelled and formatted. */
  const details = useCallback(
    (e: ActivityEvent): ActivityDetail[] => {
      const out: ActivityDetail[] = [
        { label: t("field.when"), value: `${formatDay(localDay(e.at), { weekday: true })}, ${formatClockOf(e.at)}` },
        { label: t("field.who"), value: actorName(e) },
      ];
      const w = where(e);
      if (w) out.push({ label: t("field.where"), value: w });
      if (e.subject) {
        const label = e.subject.type === "setting" && SETTING_KEYS.includes(e.subject.label) ? t(`setting.${e.subject.label}`) : e.subject.label;
        out.push({ label: t("field.about"), value: label, href: e.subject.href });
      }
      const d = e.data;
      if (e.kind === "settings.changed" && d.before !== undefined) {
        out.push({ label: t("field.change"), value: `${d.before ?? ""} → ${d.after ?? ""}` });
      }
      for (const [k, v] of Object.entries(d)) {
        if (v === null || v === undefined || v === "") continue;
        if (k === "setting" || k === "before" || k === "after") continue;
        if (k === "max" && d.attempt !== undefined) continue;
        let value = String(v);
        if (MONEY_KEYS.has(k) && typeof v === "number") value = formatMoney(v);
        else if (PERCENT_KEYS.has(k)) value = `${v}%`;
        else if (k === "usedAt") value = formatDateTime(String(v));
        else if (k === "from" || k === "to") value = formatClock(String(v));
        else if (k === "date") value = formatDay(String(v), { weekday: true });
        else if (k === "attempt") value = `${v} / ${d.max ?? 3}`;
        else if (k === "reason") {
          const group = e.kind === "ticket.refused" ? "refusal" : "refund";
          try {
            value = t(`${group}.${String(v)}`);
          } catch {
            value = String(v);
          }
        }
        const label = (() => {
          try {
            return t(`field.${k}`);
          } catch {
            return k;
          }
        })();
        out.push({ label, value, mono: k === "code" });
      }
      out.push({ label: t("field.id"), value: e.id, mono: true });
      return out;
    },
    [actorName, t, where],
  );

  return { t, sentence, plain, kindLabel, severityLabel, groupLabel, where, ago, details, actorName };
}

/** The glyph tile a row leads with. */
export function KindBadge({ kind, severity, className }: { kind: ActivityKind; severity: ActivitySeverity; className?: string }) {
  const Icon = ACTIVITY_ICON[kind];
  return (
    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line bg-card", SEVERITY_ICON_CLASS[severity], className)}>
      <Icon size={15} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** Initials for a person, or a mark for the system. Decoration - the name is in the sentence. */
export function Initials({ name, className }: { name: string | null; className?: string }) {
  const text = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "CF";
  return (
    <span aria-hidden className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-subtle text-[0.75rem] font-semibold text-muted", className)}>
      {text}
    </span>
  );
}

/** Warning and serious say so in words, beside their colour. */
export function SeverityChip({ severity, label }: { severity: ActivitySeverity; label: string }) {
  if (severity === "info") return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-tight py-px text-[0.75rem] font-medium",
        severity === "critical" ? "bg-danger/10 text-danger" : "bg-warning/15 text-warning ring-1 ring-warning/35",
      )}
    >
      {label}
    </span>
  );
}
