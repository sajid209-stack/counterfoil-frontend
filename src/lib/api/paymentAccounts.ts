import { createResource, ok } from "./client";
import type {
  AccountLink,
  ApiResult,
  ListParams,
  ListResponse,
  PaymentAccount,
  PaymentAccountInput,
} from "./types";

const resource = createResource<PaymentAccount>("paymentAccounts", "Payment account", {
  sort: { provider: (a, b) => a.provider.localeCompare(b.provider) },
  defaultSort: "provider",
});

export const listPaymentAccounts = (params?: ListParams): Promise<ApiResult<ListResponse<PaymentAccount>>> =>
  resource.list(params);
export const getPaymentAccount = (id: string): Promise<ApiResult<PaymentAccount>> => resource.get(id);
export const peekPaymentAccounts = (): PaymentAccount[] => resource.peek();

/** Begin connecting a provider — creates the account in `pending_onboarding`
 *  with the provider's typical onboarding checklist still due. */
export function createPaymentAccount(input: PaymentAccountInput): Promise<ApiResult<PaymentAccount>> {
  return resource.create({
    ...input,
    status: "pending_onboarding",
    chargesEnabled: false,
    payoutsEnabled: false,
    requirementsDue: ["business_profile", "bank_account", "identity_verification"],
  } as Omit<PaymentAccount, "id" | "createdAt" | "updatedAt">);
}

/** The hosted onboarding link the operator opens to finish KYC (mock URL). */
export async function createAccountLink(id: string): Promise<ApiResult<AccountLink>> {
  return ok({
    url: `https://connect.counterfoil.app/onboarding/${id}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
}

/** Mock-advance onboarding: mark the account live (backend does this via the
 *  provider webhook / account.updated event). */
export function activatePaymentAccount(id: string): Promise<ApiResult<PaymentAccount>> {
  return resource.update(id, {
    status: "active",
    chargesEnabled: true,
    payoutsEnabled: true,
    requirementsDue: [],
  });
}

export function disablePaymentAccount(id: string): Promise<ApiResult<PaymentAccount>> {
  return resource.update(id, { status: "disabled", chargesEnabled: false, payoutsEnabled: false });
}

/** True when at least one account can take non-cash charges — the POS gate. */
export function canTakeNonCash(): boolean {
  return resource.peek().some((a) => a.status === "active" && a.chargesEnabled);
}
