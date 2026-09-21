"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ChevronRight, MessageSquareOff, Percent, Wallet, WifiOff, type LucideIcon } from "lucide-react";
import { PageShell } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  getAccessPolicy,
  getNotificationSettings,
  getOperator,
  getTaxConfig,
  listCategories,
  listCounters,
  listDevices,
  listLocations,
  listPaymentAccounts,
  listProducts,
  listResources,
  listRoles,
  listStaff,
  listStorefronts,
} from "@/lib/api";
import { DEMO_TODAY } from "@/lib/schedule";
import { isDeviceQuiet } from "@/lib/devices";
import { LOCALE_LABELS, type Locale } from "@/i18n/locale";
import { SearchField } from "./_components/SettingsKit";
import { SETTINGS_GROUPS, resourceNoun, type SettingsItemKey } from "./_lib/nav";

type Status = { text: string; tone?: "warn" } | null | undefined;

interface Attention {
  key: string;
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
}

const noSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/** "6 counters · 2 closed" — the parts that apply, and nothing for the ones that do not. */
const joined = (...parts: (string | null | false)[]) => parts.filter(Boolean).join(" · ");

/**
 * Settings, as a board rather than a menu.
 *
 * The old hub was ten identical cards — icon, name, sentence — under a tab
 * strip listing the same ten, so the page answered "where is X" twice and
 * "is my business set up" not at all. Every row here states the value that
 * section currently holds ("BDT · Asia/Dhaka", "bKash · cash", "3 devices ·
 * 1 quiet"), read from the same records the rest of the product runs on, and
 * anything that is costing the operator money or silently misbehaving is lifted
 * above the groups where it cannot be missed.
 *
 * The counts are the counts the lists behind them show. They used to count
 * only what was active, so this page said "2 locations" above a list of three
 * and "4 counters" above six; now they count everything that exists and say
 * how many of those are closed, off or out of service.
 *
 * Search finds a setting by what someone would type rather than where it is
 * filed: "VAT", "bKash", "password", "dark mode". Each item carries keywords in
 * the reader's language, so a phrase that is not in its title still finds it.
 *
 * A status that the product does not actually store is left blank rather than
 * guessed: two-step sign-in has no saved state yet, so Security says nothing.
 */
export default function SettingsIndex() {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const tm = useTranslations("moneysetup");
  const locale = useLocale() as Locale;
  const { theme } = useTheme();
  // The stored theme only exists in the browser; naming it before hydration
  // would render one word on the server and another on the client.
  const mounted = useSyncExternalStore(noSubscribe, onClient, onServer);
  const [query, setQuery] = useState("");

  const opQ = useApiQuery(() => getOperator(), []);
  const taxQ = useApiQuery(() => getTaxConfig(), []);
  const locQ = useApiQuery(() => listLocations({ pageSize: 500 }), []);
  const ctrQ = useApiQuery(() => listCounters({ pageSize: 500 }), []);
  const resQ = useApiQuery(() => listResources({ pageSize: 500 }), []);
  const catQ = useApiQuery(() => listCategories({ pageSize: 500 }), []);
  const sfQ = useApiQuery(() => listStorefronts({ pageSize: 200 }), []);
  const payQ = useApiQuery(() => listPaymentAccounts({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const roleQ = useApiQuery(() => listRoles({ pageSize: 500 }), []);
  const devQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);
  const prodQ = useApiQuery(() => listProducts({ pageSize: 500 }), []);
  const notifQ = useApiQuery(() => getNotificationSettings(), []);
  const accessQ = useApiQuery(() => getAccessPolicy(), []);

  const op = opQ.data;
  const locations = locQ.data?.data.filter((r) => r.status !== "archived");
  const notSelling = locations?.filter((r) => r.status === "inactive").length ?? 0;
  const counters = ctrQ.data?.data.filter((r) => r.status !== "archived");
  const closedCounters = counters?.filter((r) => r.status === "inactive").length ?? 0;
  const resources = resQ.data?.data.filter((r) => r.status === "active");
  const outOfService = resources?.filter((r) => r.outOfService).length ?? 0;
  const categories = catQ.data?.data.filter((c) => c.active);
  const sheets = sfQ.data?.data;
  const livePages = sheets?.filter((x) => x.published).length ?? 0;
  const live = payQ.data?.data.filter((a) => a.status === "active").map((a) => tm(`provider.${a.provider}`));
  const staff = staffQ.data?.data;
  const members = staff?.filter((s) => s.status === "active").length ?? 0;
  const invited = staff?.filter((s) => s.status === "invited").length ?? 0;
  const roles = roleQ.data?.data;
  const devices = devQ.data?.data.filter((d) => d.status !== "archived");
  const devicesOff = devices?.filter((d) => d.status === "inactive").length ?? 0;
  const quiet = devices?.filter((d) => d.status === "active" && isDeviceQuiet(d, DEMO_TODAY)).length ?? 0;
  const reducedBookings = (prodQ.data?.data ?? []).filter((p) => p.status === "active" && p.taxClass === "reduced").length;
  // A reduced class nobody uses is a harmless zero; a reduced class that
  // bookings ARE filed under, at 0%, is those bookings being sold untaxed.
  const reducedUntaxed = !!op && (op.reducedRatePct ?? 0) === 0 && reducedBookings > 0;
  const noun = resources ? resourceNoun(resources) : null;
  const notif = notifQ.data;
  const access = accessQ.data;
  const messagesOn = notif ? Object.values(notif.customer).filter((c) => c.sms || c.email).length : 0;
  // With Booking confirmed off on both channels a ticket code reaches nobody
  // who did not stand at the counter — worth lifting above the list.
  const ticketsSilent = !!notif && !notif.customer.confirmation.sms && !notif.customer.confirmation.email;

  const status: Record<SettingsItemKey, Status> = {
    business: op && { text: t("hub.statusProfile", { currency: op.currency, timezone: op.defaultTimezone.replace(/_/g, " ") }) },
    locations: locations && {
      text: joined(t("hub.statusLocations", { count: locations.length }), notSelling > 0 && t("hub.statusNotSelling", { count: notSelling })),
    },
    counters: counters && {
      text: joined(t("hub.statusCounters", { count: counters.length }), closedCounters > 0 && t("hub.statusClosed", { count: closedCounters })),
    },
    resources: resources && {
      text: joined(t("hub.statusActive", { count: resources.length }), outOfService > 0 && t("hub.statusOut", { count: outOfService })),
      tone: outOfService > 0 ? "warn" : undefined,
    },
    categories: categories && { text: t("hub.statusCategories", { count: categories.length }) },
    // How many venues have a live page, and the exception when none do — a
    // business with every page still in draft is the case worth surfacing.
    storefront: sheets && {
      text: livePages > 0 ? t("hub.statusStorefront", { count: livePages }) : t("hub.statusStorefrontNone"),
      tone: livePages > 0 ? undefined : "warn",
    },
    payments: live && {
      text: live.length ? t("hub.statusLive", { providers: live.join(", ") }) : t("hub.statusCashOnly"),
      tone: live.length ? undefined : "warn",
    },
    tax:
      op && taxQ.data
        ? {
            text: t("hub.statusTax", {
              name: taxQ.data.taxName || t("nav.items.tax.title"),
              standard: op.taxRatePct,
              reduced: op.reducedRatePct ?? 0,
            }),
            tone: reducedUntaxed ? "warn" : undefined,
          }
        : undefined,
    memberships: null,
    loyalty: null,
    team: staff && {
      text: joined(t("hub.statusTeam", { count: members }), invited > 0 && t("hub.statusInvited", { count: invited })),
    },
    roles: roles && { text: t("hub.statusRoles", { count: roles.length }) },
    devices: devices && {
      text: joined(
        t("hub.statusDevices", { count: devices.length }),
        quiet > 0 && t("hub.statusQuiet", { count: quiet }),
        devicesOff > 0 && t("hub.statusOff", { count: devicesOff }),
      ),
      tone: quiet > 0 ? "warn" : undefined,
    },
    // Short, and the exception only. With quiet hours and the lock time added
    // both values wrapped to two lines and squeezed their descriptions to three;
    // a till that locks after five minutes is the setting working, not news.
    notifications: notif && {
      text: t("hub.statusMessagesOn", { on: messagesOn, total: Object.keys(notif.customer).length }),
      tone: ticketsSilent ? "warn" : undefined,
    },
    signIn: access && {
      text: joined(t(`hub.statusTwoStep.${access.twoStep}`), access.tillLockMinutes === null && t("hub.statusNoLock")),
      tone: access.tillLockMinutes === null ? "warn" : undefined,
    },
    security: null,
    preferences: mounted
      ? { text: t("hub.statusPrefs", { theme: tc(theme === "light" || theme === "dark" ? theme : "system"), language: LOCALE_LABELS[locale] }) }
      : undefined,
  };

  const attention: Attention[] = [];
  if (live && live.length === 0) {
    attention.push({ key: "cash", icon: Wallet, title: t("hub.cashOnly"), body: t("hub.cashOnlyBody"), href: "/settings/payments" });
  }
  if (reducedUntaxed) {
    attention.push({
      key: "tax",
      icon: Percent,
      title: t("hub.reducedUnset"),
      body: t("hub.reducedUnsetBody", { count: reducedBookings }),
      href: "/settings/tax",
    });
  }
  if (quiet) {
    attention.push({
      key: "devices",
      icon: WifiOff,
      title: t("hub.devicesQuiet", { count: quiet }),
      body: t("hub.devicesQuietBody"),
      href: "/settings/devices",
    });
  }

  if (ticketsSilent) {
    attention.push({
      key: "tickets",
      icon: MessageSquareOff,
      title: t("hub.noTicket"),
      body: t("hub.noTicketBody"),
      href: "/settings/notifications",
    });
  }

  // Every word typed has to START a word somewhere in the item — its title,
  // description or keywords — so "card payment" narrows rather than widens.
  // Starts, not substrings: "vat" was finding Business profile inside
  // "reser-vat-ion".
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const titleOf = (key: SettingsItemKey) => (key === "resources" && noun ? noun : t(`nav.items.${key}.title`));
  const matches = (key: SettingsItemKey) => {
    if (words.length === 0) return true;
    const hay = [titleOf(key), t(`nav.items.${key}.title`), t(`nav.items.${key}.desc`), t(`nav.items.${key}.keywords`)]
      .join(" ")
      .toLowerCase()
      .split(/[\s,.·—–()/]+/)
      .filter(Boolean);
    return words.every((w) => hay.some((h) => h.startsWith(w)));
  };
  const groups = SETTINGS_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => matches(i.key)) })).filter((g) => g.items.length > 0);
  const found = groups.reduce((n, g) => n + g.items.length, 0);
  const searching = words.length > 0;

  return (
    <PageShell title={t("hub.title")} description={t("hub.description")}>
      <div className="flex flex-col gap-major pb-hero">
        <div className="flex max-w-3xl flex-col gap-tight sm:flex-row sm:items-center sm:gap-section">
          <SearchField value={query} onChange={setQuery} label={t("hub.searchLabel")} placeholder={t("hub.searchPlaceholder")} />
          {/* The examples sit beside the field rather than in its placeholder,
              where they were cut off at "try “VAT” or “pa". While searching
              the same line says how many settings match. */}
          <p aria-live="polite" className="text-[13px] text-muted">
            {searching ? t("hub.searchCount", { count: found }) : t("hub.searchHint")}
          </p>
        </div>

        {/* While searching, the attention panel steps aside: someone looking for
            "password" has already said what they came for. */}
        {!searching && attention.length > 0 && (
          <section aria-labelledby="settings-attention" className="max-w-3xl rounded-md border border-warning/30 bg-warning-wash">
            <h2 id="settings-attention" className="px-card pb-tight pt-card text-sm font-semibold text-fg">
              {t("hub.attentionCount", { count: attention.length })}
            </h2>
            <ul className="divide-y divide-warning/20">
              {attention.map(({ key, icon: Icon, title, body, href }) => (
                <li key={key}>
                  <Link
                    href={href}
                    className="group flex min-h-14 items-center gap-section px-card py-comfortable transition-colors duration-quick hover:bg-warning/5"
                  >
                    <Icon size={18} strokeWidth={1.5} aria-hidden className="shrink-0 text-warning" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{title}</span>
                      <span className="mt-inline block text-[13px] text-muted">{body}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-inline text-[13px] font-medium text-fg">
                      {t("hub.fix")}
                      <ChevronRight size={16} strokeWidth={1.5} aria-hidden className="transition-transform duration-quick group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {groups.length === 0 ? (
          <p className="max-w-3xl text-sm text-muted">{t("hub.searchEmpty", { query: query.trim() })}</p>
        ) : (
          // Two balanced columns on a wide screen, each group kept whole. A
          // single 768px column left half a 1440 display empty; a grid would
          // have stretched the two-row groups to the height of the five-row
          // one beside them.
          <div className="xl:columns-2 xl:gap-section">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-labelledby={`settings-group-${group.key}`}
                className="mb-major break-inside-avoid"
              >
                <div className="mb-tight flex items-end justify-between gap-section">
                  <div className="min-w-0">
                    <h2 id={`settings-group-${group.key}`} className="text-base font-semibold text-fg">
                      {t(`nav.groups.${group.key}.title`)}
                    </h2>
                    <p className="mt-inline text-[13px] text-muted">{t(`nav.groups.${group.key}.desc`)}</p>
                  </div>
                </div>
                <ul className="card-surface divide-y divide-hairline overflow-hidden">
                  {group.items.map(({ key, href, icon: Icon }) => {
                    const s = status[key];
                    const statusText =
                      s === undefined ? (
                        <span aria-hidden className="inline-block h-3 w-24 animate-pulse rounded-xs bg-line" />
                      ) : s ? (
                        <span className={cn("inline-flex items-center gap-inline", s.tone === "warn" ? "text-warning" : "text-muted")}>
                          {s.tone === "warn" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warning" />}
                          {s.text}
                        </span>
                      ) : null;
                    return (
                      <li key={key}>
                        <Link
                          href={href}
                          className="group flex min-h-16 items-center gap-section px-card py-comfortable transition-colors duration-quick hover:bg-subtle/60"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-subtle text-muted ring-1 ring-inset ring-hairline transition-colors duration-quick group-hover:text-fg">
                            <Icon size={18} strokeWidth={1.5} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-fg">{titleOf(key)}</span>
                            {/* On a phone a row with a value shows the value
                                instead of the description — the phone settings
                                pattern. Both made every row four lines and the
                                index 2,142px tall; the value is what someone
                                scanning the list is looking for, and the page
                                behind the row still explains itself. */}
                            <span className={cn("mt-inline block text-[13px] text-muted", statusText && "max-sm:hidden")}>
                              {t(`nav.items.${key}.desc`)}
                            </span>
                            {statusText && <span className="mt-inline block text-[13px] sm:hidden">{statusText}</span>}
                          </span>
                          {statusText && (
                            <span className="hidden max-w-[45%] shrink-0 text-right text-[13px] sm:block">{statusText}</span>
                          )}
                          <ChevronRight
                            size={16}
                            strokeWidth={1.5}
                            aria-hidden
                            className="shrink-0 text-muted transition-transform duration-quick group-hover:translate-x-0.5"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
