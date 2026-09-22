import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useApiQuery } from "@/lib/useApi";
import { getNotificationSettings, getOperator, listDevices, listPaymentAccounts, listProducts } from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { isDeviceQuiet } from "@/lib/devices";
import type { SettingsItemKey } from "./nav";

/**
 * What in settings is costing the operator money or quietly misbehaving,
 * keyed by the section that fixes it.
 *
 * These used to be a panel on the settings index. The index is gone — Settings
 * opens on the first section — so the same four rules now mark their section
 * wherever the sections are listed: a dot in the rail, and the reason in words
 * in the phone's section menu. Nothing is lost that the index could say.
 *
 * Only the four that need a decision. A court out of service or a page still in
 * draft is a state someone chose; cash-only, a 0% reduced rate on bookings that
 * use it, a tablet nobody has seen for a week and tickets that reach nobody are
 * the product working against its operator without saying so.
 *
 * Re-read on every move between sections, so a rate fixed on Tax clears its
 * dot the moment you go anywhere else — the frame outlives the pages inside it,
 * and would otherwise keep reporting what was true when settings first opened.
 * The previous answer stays on screen while the next one loads, so the dots do
 * not flicker.
 */
export function useSettingsAttention(): Partial<Record<SettingsItemKey, string>> {
  const t = useTranslations("settings.attention");
  const pathname = usePathname();
  const payQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), [pathname]);
  const opQ = useApiQuery(() => getOperator(), [pathname]);
  const prodQ = useApiQuery(() => listProducts({ pageSize: 500 }), [pathname]);
  const devQ = useApiQuery(() => listDevices({ pageSize: 500 }), [pathname]);
  const notifQ = useApiQuery(() => getNotificationSettings(), [pathname]);

  const out: Partial<Record<SettingsItemKey, string>> = {};

  const accounts = payQ.data?.data;
  if (accounts && !accounts.some((a) => a.status === "active")) out.payments = t("cashOnly");

  // A reduced class nobody uses is a harmless zero; one that bookings ARE filed
  // under, at 0%, is those bookings being sold untaxed.
  const op = opQ.data;
  const reduced = (prodQ.data?.data ?? []).filter((p) => p.status === "active" && p.taxClass === "reduced").length;
  if (op && prodQ.data && (op.reducedRatePct ?? 0) === 0 && reduced > 0) out.tax = t("reducedUnset");

  const quiet = (devQ.data?.data ?? []).filter((d) => d.status === "active" && isDeviceQuiet(d, DEMO_TODAY)).length;
  if (quiet > 0) out.devices = t("devicesQuiet", { count: quiet });

  const notif = notifQ.data;
  if (notif && !notif.customer.confirmation.sms && !notif.customer.confirmation.email) out.notifications = t("noTicket");

  return out;
}
