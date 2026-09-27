import type { Placeholder } from "./template";

/**
 * The ticket e-mail — a subject and a body, written by the operator.
 *
 * It was product copy in the till's own message files, while the SMS about the
 * same ticket had been the operator's since the messages work. So a venue
 * could set the voice of its text message and not of its e-mail, and the two
 * arrived in different voices about one sale.
 *
 * Like the SMS, this is ONE template rather than one per locale: it is written
 * once, in the operator's own language. That is the trade the SMS already
 * made, and the alternative — a translated default the operator cannot edit —
 * is the thing this replaces.
 */
export const DEFAULT_EMAIL_SUBJECT = "Your tickets from {business} · {reference}";

export const DEFAULT_EMAIL_BODY = [
  "Hello,",
  "",
  "Your tickets for {date} are attached, with the receipt for {total}.",
  "Show the QR code at the gate — there is nothing to print.",
  "",
  "Thank you,",
  "{business}",
].join("\n");

/** What a subject line can carry before an inbox cuts it on a phone. */
export const SUBJECT_VISIBLE = 45;

export const EMAIL_PLACEHOLDERS: Placeholder[] = [
  { key: "{business}", means: "your business name" },
  { key: "{reference}", means: "the order reference" },
  { key: "{code}", means: "the first ticket's code" },
  { key: "{date}", means: "the visit date" },
  { key: "{count}", means: "how many tickets" },
  { key: "{total}", means: "what was paid" },
];
