"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Mail, Plus, UserCheck, UserX } from "lucide-react";
import { ActionMenu, Avatar, Button, ConfirmDialog, PageShell, StatusPill, Tabs, useToast, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listRoles, listStaff, updateStaff, type Staff, type StaffStatus } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { RecordList, RecordRow, SearchField, SectionSkeleton } from "../_components/SettingsKit";
import { useSince } from "../_lib/time";

type Tab = "all" | StaffStatus;
const TABS: Tab[] = ["all", "active", "invited", "suspended"];

/**
 * The team.
 *
 * It was the orders table with a "Reset password" button printed on every
 * row — including for someone invited who had never set a password, and for
 * people already suspended. Team screens that work are read for name, role and
 * whether the person can get in, and each row offers only the actions that
 * apply to its state. So status is a set of tabs with counts, a status pill
 * appears only where it is the exception (a column of "Active" says nothing),
 * and the actions sit in a row menu that changes with the person: resend a
 * pending invite, reset or suspend someone active, reactivate someone
 * suspended.
 */
export default function TeamPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<Staff | null>(null);
  const [busy, setBusy] = useState(false);

  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);
  const locations = locationsQ.data?.data ?? [];
  const roleName = (id: string) => rolesQ.data?.data.find((r) => r.id === id)?.name ?? "—";
  const since = useSince();

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: staff.length, active: 0, invited: 0, suspended: 0 };
    for (const s of staff) c[s.status] += 1;
    return c;
  }, [staff]);

  const q = search.trim().toLowerCase();
  const rows = staff
    .filter((s) => tab === "all" || s.status === tab)
    .filter((s) => !q || [s.name, s.email ?? "", s.phone ?? ""].some((v) => v.toLowerCase().includes(q)));

  const workplace = (s: Staff) => {
    if (s.locationIds.length === 0) return t("team.nowhere");
    if (s.locationIds.length === 1) return locations.find((l) => l.id === s.locationIds[0])?.name ?? "—";
    return t("team.locationsCount", { count: s.locationIds.length });
  };
  // "Active 30 May" reads as a claim that a suspended person is active. The
  // pill already says suspended, so their line says when they last were.
  const activity = (s: Staff) =>
    s.status === "invited"
      ? t("team.inviteSent")
      : !s.lastActiveAt
        ? t("team.neverActive")
        : s.status === "suspended"
          ? t("team.lastActive", { when: since(s.lastActiveAt) })
          : t("team.activeAgo", { when: since(s.lastActiveAt) });

  const setStatus = async (s: Staff, status: StaffStatus) => {
    setBusy(true);
    const res = await updateStaff(s.id, { status });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(status === "suspended" ? t("team.suspendedToast", { name: s.name }) : t("team.reactivated", { name: s.name }));
    staffQ.reload();
  };

  const actions = (s: Staff): ActionMenuItem[] => {
    const who = s.email ?? s.phone ?? s.name;
    if (s.status === "invited") {
      return [
        {
          key: "resend",
          label: t("team.resendInvite"),
          icon: <Mail size={16} strokeWidth={1.5} />,
          onSelect: () => toast.success(t("team.inviteResent", { who })),
        },
      ];
    }
    if (s.status === "suspended") {
      return [
        {
          key: "reactivate",
          label: t("team.reactivate"),
          icon: <UserCheck size={16} strokeWidth={1.5} />,
          onSelect: () => setStatus(s, "active"),
        },
      ];
    }
    return [
      {
        key: "reset",
        label: t("team.resetPassword"),
        icon: <KeyRound size={16} strokeWidth={1.5} />,
        onSelect: () => toast.success(t("team.resetSent", { who })),
      },
      {
        key: "suspend",
        label: t("team.suspend"),
        icon: <UserX size={16} strokeWidth={1.5} />,
        destructive: true,
        disabled: s.id === DEMO_STAFF_ID,
        onSelect: () => setConfirm(s),
      },
    ];
  };

  return (
    <PageShell
      title={t("team.title")}
      description={t("team.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/team/new")}>
          {t("team.invite")}
        </Button>
      }
    >
      <div className="flex max-w-5xl flex-col gap-section pb-hero">
        <Tabs
          items={TABS.map((v) => ({ value: v, label: t(`team.tab.${v}`), count: counts[v] }))}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
        {staffQ.loading ? (
          <SectionSkeleton />
        ) : (
          <RecordList
            label={t("team.title")}
            header={
              <div className="flex flex-col gap-tight border-b border-hairline px-section py-tight sm:flex-row sm:items-center sm:justify-between sm:px-major">
                <SearchField value={search} onChange={setSearch} label={t("team.searchLabel")} placeholder={t("team.searchPlaceholder")} />
                {/* The tab already carries the count; this line speaks only while
                    a search is narrowing the list. */}
                <p className="text-[13px] text-muted" aria-live="polite">
                  {q ? t("team.showing", { count: rows.length }) : null}
                </p>
              </div>
            }
          >
            {rows.length === 0 ? (
              <li className="px-major py-wide text-center text-sm text-muted">{q ? t("team.noMatch") : t("team.emptyTab")}</li>
            ) : (
              rows.map((s) => {
                const isYou = s.id === DEMO_STAFF_ID;
                const nowhere = s.locationIds.length === 0;
                return (
                  <RecordRow
                    key={s.id}
                    href={`/settings/team/${s.id}`}
                    leading={<Avatar name={s.name} size={36} soft />}
                    title={s.name}
                    badges={
                      <>
                        {isYou ? <span className="rounded-xs border border-line px-tight text-[12px] font-medium text-muted">{t("team.you")}</span> : null}
                        {s.status !== "active" ? <StatusPill status={s.status} /> : null}
                      </>
                    }
                    meta={
                      <>
                        <span className="block truncate">{s.email ?? s.phone}</span>
                        <span className="block md:hidden">
                          {roleName(s.roleId)} · <span className={cn(nowhere ? "text-warning" : undefined)}>{workplace(s)}</span> · {activity(s)}
                        </span>
                      </>
                    }
                    columns={
                      <>
                        <span className="w-28 truncate text-sm text-fg">{roleName(s.roleId)}</span>
                        <span className={cn("hidden w-40 truncate text-[13px] lg:block", nowhere ? "text-warning" : "text-muted")}>{workplace(s)}</span>
                        <span className="w-44 text-[13px] text-muted">{activity(s)}</span>
                      </>
                    }
                    menu={<ActionMenu label={t("team.actionsFor", { name: s.name })} items={actions(s)} />}
                  />
                );
              })
            )}
          </RecordList>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) setStatus(confirm, "suspended");
        }}
        title={confirm ? t("team.suspendTitle", { name: confirm.name }) : ""}
        message={t("team.suspendBody")}
        confirmLabel={t("team.suspend")}
        loading={busy}
      />
    </PageShell>
  );
}
