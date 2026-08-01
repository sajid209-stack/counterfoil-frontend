// Ticket-delivery SMS: the operator edits one template; placeholders are
// substituted at send time. Unknown placeholders pass through untouched so a
// typo is visible in the preview rather than silently dropped.
export const DEFAULT_SMS_TEMPLATE =
  "Your {business} ticket {code} is confirmed for {date}. Show this SMS or the code at the gate. Thank you!";

export const SMS_PLACEHOLDERS: { key: string; means: string }[] = [
  { key: "{business}", means: "your business name" },
  { key: "{code}", means: "the ticket code" },
  { key: "{date}", means: "the visit date" },
];

export function renderSms(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}
