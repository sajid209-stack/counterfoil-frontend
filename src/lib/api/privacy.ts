import { delay, ok } from "./client";
import type { ApiResult } from "./types";

/*
 * The business's customer-facing privacy policy (settings.v2 privacy-policy).
 *
 * The words are the operator's own; Counterfoil's policy and terms are linked
 * beside them, not merged in. Singleton, mock-backed. The storefront reads it
 * for /s/<slug>/privacy, its footer link and the checkout consent line.
 */
export interface PrivacySettings {
  /** The policy, plain text; a blank line starts a new paragraph. */
  policy: string;
  /** YYYY-MM-DD the policy was last saved. */
  updatedOn: string;
  contactEmail: string;
  contactPhone: string;
  showInFooter: boolean;
  showAtCheckout: boolean;
  showOnReceipts: boolean;
}

export const COUNTERFOIL_PRIVACY_URL = "https://counterfoil.app/privacy";
export const COUNTERFOIL_TERMS_URL = "https://counterfoil.app/terms";

/** The starting text for a Bangladeshi venue, with its name and contact already in it so there is nothing to fill in. */
export const defaultPrivacyPolicy = (business: string, contact: string): string => `What we collect
When you book with ${business} we ask for your name, mobile number and, if you give it, your email. We also keep your booking history: what you booked, when, and how you paid.

Why we collect it
We use these details to confirm your booking, send your ticket and reminders by SMS or email, let you in at the door, and sort things out if something goes wrong. We do not sell your details.

Who can see it
Our staff can see your booking details. Companies that help us run the service can see what they need to do their part: payment providers such as bKash, SSLCOMMERZ and your card bank, SMS and email senders, and the marketplace you booked through, if you did. We share your details with authorities only when the law requires it.

How long we keep it
We keep booking records for as long as the law requires us to keep accounts and VAT records. After that we delete them or remove your name from them.

Your choices
You can ask to see what we hold about you, ask us to correct it, or ask us to delete it. Contact us at ${contact} and we will reply within 7 days. Some records, such as paid invoices, we must keep for the period the law sets.`;

const seed: PrivacySettings = {
  policy: defaultPrivacyPolicy("us", "privacy@lalbagh.example"),
  updatedOn: "2026-07-01",
  contactEmail: "privacy@lalbagh.example",
  contactPhone: "",
  showInFooter: true,
  showAtCheckout: true,
  showOnReceipts: false,
};

let state: PrivacySettings = structuredClone(seed);

/** Today as YYYY-MM-DD, local. */
const today = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export async function getPrivacySettings(): Promise<ApiResult<PrivacySettings>> {
  await delay();
  return ok(structuredClone(state));
}

export async function updatePrivacySettings(next: PrivacySettings): Promise<ApiResult<PrivacySettings>> {
  await delay();
  const textChanged = next.policy !== state.policy;
  state = { ...structuredClone(next), updatedOn: textChanged ? today() : state.updatedOn };
  return ok(structuredClone(state));
}
