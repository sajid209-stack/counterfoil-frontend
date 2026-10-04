"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button, EmptyState, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  getCustomer,
  getCustomerStats,
  listOrders,
  loyaltyAccount,
  membershipsFor,
  peekBookings,
} from "@/lib/api";
import { FEATURES } from "@/lib/features";
import { DEMO_NOW_MINUTES, DEMO_TODAY } from "@/lib/schedule";
import { buildCustomerProfile, upcomingBookings, type WallTime } from "@/lib/customerProfile";
import { Panel } from "./_components/Panel";
import { ProfileHeader } from "./_components/ProfileHeader";
import { ComingUp } from "./_components/ComingUp";
import { NotesCard } from "./_components/NotesCard";
import { WhatTheyComeFor } from "./_components/WhatTheyComeFor";
import { RecentVisits } from "./_components/RecentVisits";
import { ContactCard } from "./_components/ContactCard";
import { ConsentCard } from "./_components/ConsentCard";
import { AtAGlance } from "./_components/AtAGlance";
import { MembershipTab } from "./MembershipTab";

/** The demo's now as wall-clock text — the one clock the till and the calendar
 *  also use, never `new Date()`. */
const AS_OF: WallTime = `${DEMO_TODAY}T${String(Math.floor(DEMO_NOW_MINUTES / 60)).padStart(2, "0")}:${String(
  DEMO_NOW_MINUTES % 60,
).padStart(2, "0")}`;

/** Orders whose money counts towards a customer's balance — the same set
 *  `customerStats` sums, so the link behind "Owes" agrees with the figure. */
const COUNTED = new Set(["paid", "partial", "partly_refunded"]);

/**
 * A customer, person first.
 *
 * The page used to read like a ledger about someone: an identity card, six
 * equal money tiles, then tabs of orders. It now follows the order a person
 * serving them wants it in — who they are, what they have booked next, what
 * staff know, what they come for — and keeps the money and history last and
 * small. Money lives in "At a glance" and the last five orders; the full list
 * is one link away.
 *
 * Wide screens put the person's own facts (contact, consent, figures) in a side
 * column; a phone gets one column in the same order.
 */
export default function CustomerDetailPage() {
  const t = useTranslations("customers");
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const customerQ = useApiQuery(() => getCustomer(params.id), [params.id]);
  const statsQ = useApiQuery(() => getCustomerStats(params.id), [params.id]);
  const ordersQ = useApiQuery(
    () => listOrders({ pageSize: 200, filters: { customerId: params.id }, sort: "createdAt", order: "desc" }),
    [params.id],
  );

  const customer = customerQ.data;
  const stats = statsQ.data;
  const orders = useMemo(() => ordersQ.data?.data ?? [], [ordersQ.data]);

  /* Bookings hang off orders (`orderId`), so this customer's are the ones
     whose order is theirs. Read once the orders have arrived. */
  const bookings = useMemo(() => {
    const ids = new Set(orders.map((o) => o.id));
    return peekBookings().filter((b) => ids.has(b.orderId));
  }, [orders]);

  const profile = useMemo(() => buildCustomerProfile({ orders, bookings, asOf: AS_OF }), [orders, bookings]);
  const upcoming = useMemo(() => upcomingBookings(bookings, AS_OF, 3), [bookings]);
  const owingOrderIds = useMemo(
    () =>
      orders
        .filter((o) => COUNTED.has(o.status))
        .filter((o) => o.total - o.payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0) > 0)
        .map((o) => o.id),
    [orders],
  );

  const reloadAll = () => {
    customerQ.reload();
    statsQ.reload();
    ordersQ.reload();
  };

  if (!customerQ.loading && !customer) {
    return (
      <PageShell title={t("title")}>
        <EmptyState
          title={t("notFoundTitle")}
          message={t("notFoundMessage")}
          action={<Button onClick={() => router.push("/customers")}>{t("backToList")}</Button>}
        />
      </PageShell>
    );
  }
  /* Skeleton only until the first answers arrive. A reload after saving a note
     keeps the data it already has on screen, so the page does not flash empty
     and lose the reader's place. */
  if (!customer || !stats || !ordersQ.data) {
    return (
      <PageShell title={t("title")}>
        <div aria-busy="true" className="flex flex-col gap-section">
          <div className="h-40 animate-pulse rounded-md bg-line" />
          <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_21.25rem]">
            <div className="flex flex-col gap-section">
              <div className="h-32 animate-pulse rounded-md bg-line" />
              <div className="h-56 animate-pulse rounded-md bg-line" />
            </div>
            <div className="h-72 animate-pulse rounded-md bg-line" />
          </div>
        </div>
      </PageShell>
    );
  }

  const showMembership = FEATURES.memberships || FEATURES.loyalty;
  const memberships = showMembership ? membershipsFor(customer.id) : [];
  const points = showMembership ? loyaltyAccount(customer.id) : null;

  return (
    <PageShell
      title={customer.name}
      description={t("description")}
      actions={
        <Button
          variant="tertiary"
          icon={<ArrowLeft size={16} strokeWidth={1.5} />}
          onClick={() => router.push("/customers")}
        >
          {t("backToList")}
        </Button>
      }
    >
      <div className="flex flex-col gap-section">
        <ProfileHeader customer={customer} profile={profile} onChanged={reloadAll} />

        <div className="grid gap-section lg:grid-cols-[minmax(0,1fr)_21.25rem] lg:items-start">
          <div className="flex min-w-0 flex-col gap-section">
            <ComingUp bookings={upcoming} />
            <NotesCard customer={customer} onChanged={reloadAll} />
            <WhatTheyComeFor profile={profile} />
            <RecentVisits customer={customer} orders={orders} total={stats.orders} />
          </div>

          <div className="flex min-w-0 flex-col gap-section">
            <ContactCard customer={customer} onChanged={reloadAll} />
            <ConsentCard customer={customer} onChanged={reloadAll} />
            <AtAGlance customer={customer} stats={stats} owingOrderIds={owingOrderIds} />
            {/* Hidden while the backend has neither (lib/features); the card is
                kept so lifting the flag restores it whole. */}
            {showMembership && points && (
              <Panel title={t("tabMembership")}>
                <MembershipTab
                  key={`${memberships.length}-${points.balance}`}
                  customerId={customer.id}
                  memberships={memberships}
                  points={points}
                  onChanged={reloadAll}
                />
              </Panel>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
