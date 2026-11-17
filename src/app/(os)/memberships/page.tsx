"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import { ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui";
import { PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { listMembershipTiers, listMemberships, membershipSummary } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { Figures, type ListTab } from "./_components/list/Figures";
import { MembersTable } from "./_components/list/MembersTable";
import { PlansStrip } from "./_components/list/PlansStrip";

/**
 * Memberships (docs/memberships.md 4.1): four figures, the plans as a strip you
 * can filter by, and the members list. Everything that changes a membership
 * lives in a row menu; the page reloads its figures and list after each write.
 */
export default function MembershipsPage() {
  const t = useTranslations("membershipsList");

  const [tab, setTab] = useState<ListTab>("active");
  const [search, setSearch] = useState("");
  const [tierId, setTierId] = useState("");
  const [version, setVersion] = useState(0);

  const summaryQ = useApiQuery(() => membershipSummary(), [version]);
  const tiersQ = useApiQuery(() => listMembershipTiers({ pageSize: 100 }), [version]);

  const filters = useMemo(() => {
    const f: Record<string, string | boolean> = tab === "ending" ? { expiringSoon: true } : { effectiveStatus: tab === "ended" ? "lapsed" : tab };
    if (tierId) f.tierId = tierId;
    return f;
  }, [tab, tierId]);
  const listQ = useApiQuery(() => listMemberships({ pageSize: 500, search, filters }), [tab, tierId, search, version]);

  const summary = summaryQ.data;
  const tiers = useMemo(() => (tiersQ.data?.data ?? []).filter((x) => x.status !== "archived"), [tiersQ.data]);
  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data]);
  const bump = () => setVersion((v) => v + 1);

  const primary: PagePrimary = { label: t("addMember"), href: "/memberships/new" };
  const none = !!summary && summary.active + summary.lapsed + summary.paused + summary.cancelled === 0;
  const failed = summaryQ.error || listQ.error;

  return (
    <PageShell title={t("title")} description={t("description")} primary={primary}>
      <div className="flex flex-col gap-major">
        {failed && (
          <Notice tone="danger" title={t("loadError")} action={{ label: t("retry"), onClick: bump }} />
        )}
        {none ? (
          <EmptyState
            icon={<Users size={24} strokeWidth={1.5} aria-hidden />}
            title={t("empty.title")}
            message={t("empty.body")}
            action={
              <div className="flex flex-wrap justify-center gap-tight">
                <ButtonLink href="/memberships/new" variant="primary">
                  {t("addMember")}
                </ButtonLink>
                {tiers.length === 0 && (
                  <ButtonLink href="/memberships/plans/new" variant="secondary">
                    {t("empty.createPlan")}
                  </ButtonLink>
                )}
              </div>
            }
          />
        ) : (
          <>
            <Figures summary={summary} tab={tab} onTab={setTab} />
            <PlansStrip tiers={summary ? tiers : undefined} summary={summary} selected={tierId} onSelect={setTierId} />
            {!summary ? (
              <Skeleton className="h-64 w-full rounded-card" />
            ) : (
              <MembersTable
                rows={rows}
                loading={listQ.loading && !listQ.data}
                summary={summary}
                tiers={tiers}
                tab={tab}
                onTab={setTab}
                search={search}
                onSearch={setSearch}
                tierId={tierId}
                onTierId={setTierId}
                primary={primary}
                onChanged={bump}
              />
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
