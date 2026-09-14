"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Mail, Plus, UserCheck, UserMinus, UserX } from "lucide-react";
import { ActionMenu, Avatar, Button, ConfirmDialog, PageShell, StatusPill, Tabs, useToast, type ActionMenuItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listLocations, listRoles, listStaff, revokeInvite, updateStaff, type Staff, type StaffStatus } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { RecordList, RecordRow, SearchField, SectionSkeleton, controlCls } from "../_components/SettingsKit";
import { useSince } from "../_lib/time";

type Tab = "all" | StaffStatus;
const TABS: Tab[] = ["all", "active", "invited", "suspended"];

type Confirm = { staff: Staff; kind: "suspend" | "revoke" };

/**
 * The team.
 *
 * It was the orders table with a "Reset password" button printed on every
 * row — including for someone invited who had never set a password, and for
 * people already suspended. Team screens that work are read for name, role and
 * whether the person can get in, and each row offers only the actions that
 * apply to its state. So status is a set of tabs with counts, a status pill
 * appears only where it is the exception, and the actions sit in a row menu
 * that changes with the person.
 *
 * The questions a manager actually asks of this list — who are my cashiers,
 * who works at the museum — are a role and a place, so both are filters beside
 * the search, and the tab counts follow them: "Invited 1" means one invited
 * cashier once Cashier is chosen, not one invited person somewhere. Both can be
 * set from a link (`?location=`, `?role=`), so a location's "View team" opens on
 * the people who work there.
 *
 * Suspending stays in the menu, behind a confirmation, and is not a switch on
 * the row. It signs a person out everywhere; that is not something to be one
 * mis-tap away.
 */
export default function TeamPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [roleId, setRoleId] = useState(() => params.get("role") ?? "");
  const [locationId, setLocationId] = useState(() => params.get("location") ?? "");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);

  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);
  const roles = rolesQ.data?.data ?? [];
  const locations = locationsQ.data?.data ?? [];
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const since = useSince();

  const q = search.trim().toLowerCase();
  const filtered = staff
    .filter((s) => !roleId || s.roleId === roleId)
    .filter((s) => !locationId || s.locationIds.includes(locationId))
    .filter((s) => !q || [s.name, s.email ?? "", s.phone ?? ""].some((v) => v.toLowerCase().includes(q)));
  const counts: Record<Tab, number> = { all: filtered.length, active: 0, invited: 0, suspended: 0 };
  for (const s of filtered) counts[s.status] += 1;
  const rows = filtered.filter((s) => tab === "all" || s.status === tab);
  const filtering = !!q || !!roleId || !!locationId;

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

  const revoke = async (s: Staff) => {
    setBusy(true);
    const res = await revokeInvite(s.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("team.revoked", { name: s.name }));
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
        {
          key: "revoke",
          label: t("team.revokeInvite"),
          icon: <UserMinus size={16} strokeWidth={1.5} />,
          destructive: true,
          onSelect: () => setConfirm({ staff: s, kind: "revoke" }),
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
    const isYou = s.id === DEMO_STAFF_ID;
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
        disabled: isYou,
        hint: isYou ? t("team.suspendSelf") : undefined,
        onSelect: () => setConfirm({ staff: s, kind: "suspend" }),
      },
    ];
  };

  const select = cn(controlCls(), "pr-section sm:w-44");

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
        {!staffQ.data ? (
          <SectionSkeleton />
        ) : (
          <RecordList
            label={t("team.title")}
            header={
              <div className="flex flex-col gap-tight border-b border-hairline px-section py-tight sm:flex-row sm:flex-wrap sm:items-center sm:px-major">
                <SearchField value={search} onChange={setSearch} label={t("team.searchLabel")} placeholder={t("team.searchPlaceholder")} />
                <select aria-label={t("team.filterRole")} value={roleId} onChange={(e) => setRoleId(e.target.value)} className={select}>
                  <option value="">{t("team.anyRole")}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <select aria-label={t("team.filterLocation")} value={locationId} onChange={(e) => setLocationId(e.target.value)} className={select}>
                  <option value="">{t("team.anyLocation")}</option>
                  {locations
                    .filter((l) => l.status !== "archived")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
                <div className="flex items-center gap-tight sm:ml-auto">
                  <p className="text-[13px] text-muted" aria-live="polite">
                    {filtering ? t("team.showing", { count: rows.length }) : null}
                  </p>
                  {filtering && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setRoleId("");
                        setLocationId("");
                      }}
                      className="inline-flex min-h-11 items-center rounded-sm px-tight text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
                    >
                      {t("team.clearFilters")}
                    </button>
                  )}
                </div>
              </div>
            }
          >
            {rows.length === 0 ? (
              <li className="px-major py-wide text-center text-sm text-muted">{filtering ? t("team.noMatch") : t("team.emptyTab")}</li>
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
          if (!confirm) return;
          if (confirm.kind === "revoke") void revoke(confirm.staff);
          else void setStatus(confirm.staff, "suspended");
        }}
        title={
          confirm
            ? confirm.kind === "revoke"
              ? t("team.revokeTitle", { name: confirm.staff.name })
              : t("team.suspendTitle", { name: confirm.staff.name })
            : ""
        }
        message={confirm?.kind === "revoke" ? t("team.revokeBody") : t("team.suspendBody")}
        confirmLabel={confirm?.kind === "revoke" ? t("team.revokeInvite") : t("team.suspend")}
        loading={busy}
      />
    </PageShell>
  );
}
