import { ok } from "./client";
import type { ApiResult, NotificationSettings } from "./types";

/*
 * What customers and staff are sent, and when.
 *
 * One settings record per business (notifications.v1). Booking systems settle
 * on the same shape — a set of events, each switched on per channel, a reminder
 * a chosen number of hours before the visit, and a quiet window so a text does
 * not arrive at midnight — and staff alerts beside them, each sent to the roles
 * that should hear it.
 *
 * Kept in this module rather than on the operator, because the backend owns it
 * as its own resource and a patch to the business profile must never be able to
 * switch a customer's reminders off by accident.
 */
const seed: NotificationSettings = {
  customer: {
    confirmation: { sms: true, email: true },
    reminder: { sms: true, email: false },
    rescheduled: { sms: true, email: true },
    cancelled: { sms: true, email: true },
    refunded: { sms: false, email: true },
    followUp: { sms: false, email: false },
  },
  reminderHours: 24,
  followUpHours: 2,
  quietHours: { enabled: true, from: "21:00", to: "08:00" },
  senderName: "LALBAGH",
  replyToEmail: "hello@lalbagh.example",
  staff: {
    soldOut: { enabled: true, roleIds: ["role_manager", "role_supervisor"] },
    cashVariance: { enabled: true, roleIds: ["role_manager"] },
    deviceOffline: { enabled: true, roleIds: ["role_manager"] },
    largeRefund: { enabled: false, roleIds: ["role_manager"] },
    dailySummary: { enabled: true, roleIds: ["role_manager"] },
  },
};

let state: NotificationSettings = structuredClone(seed);

const pause = () => new Promise((r) => setTimeout(r, 220));

export async function getNotificationSettings(): Promise<ApiResult<NotificationSettings>> {
  await pause();
  return ok(structuredClone(state));
}

export async function updateNotificationSettings(next: NotificationSettings): Promise<ApiResult<NotificationSettings>> {
  await pause();
  state = structuredClone(next);
  return ok(structuredClone(state));
}
