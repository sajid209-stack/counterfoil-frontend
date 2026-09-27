// Ticket-delivery SMS: the operator edits one template; placeholders are
// substituted at send time. Unknown placeholders pass through untouched so a
// typo is visible in the preview rather than silently dropped.
export const DEFAULT_SMS_TEMPLATE =
  "Your {business} ticket {code} is confirmed for {date}. Show this SMS or the code at the gate. Thank you!";

import type { Placeholder } from "./template";

export const SMS_PLACEHOLDERS: Placeholder[] = [
  { key: "{business}", means: "your business name" },
  { key: "{code}", means: "the ticket code" },
  { key: "{date}", means: "the visit date" },
];

/** The shared substitution, under the name this module's callers already use.
 *  The e-mail template uses the same one — see `lib/template`. */
export { renderTemplate as renderSms } from "./template";
