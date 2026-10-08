"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound, Mail, UserCheck, UserMinus, UserX } from "lucide-react";
import { ActionMenu, Avatar, ConfirmDialog, FilterBar, Select, StatusPill, Tabs, useToast, type ActionMenuItem, type FilterSpec } from "@/components/ui";
import { PageShell, PageToolbar, type PagePrimary } from "@/components/ui/PageShell";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  devicesForStaff,
  listDevices,
  listLocations,
  listRoles,
  listStaff,
  revokeInvite,
  updateStaff,
  type Staff,
  type StaffStatus,
} from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { RecordList, RecordRow, SearchField, SectionSkeleton } from "../_components/SettingsKit";
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
 * who works at the museum — are a role and a place. Search stays on the row,
 * because it is what a list is opened with; role and venue sit behind the one
 * Filters button, and whatever is set comes back out as a chip with "Clear
 * filters". The tab counts follow them: "Invited 1" means one invited cashier
 * once Cashier is chosen, not one invited person somewhere. Both can be set from
 * a link (`?location=`, `?role=`), so a location's "View team" opens on the
 * people who work there.
 *
 * A row is two lines: the name, then what the person is — role, venue and, from
 * md, their e-mail. The name is never cut: it wraps, and the right-hand columns
 * only appear where there is room left over for them. A status pill appears only
 * where the status is the exception.
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
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 500 }), []);

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
  // How many tablets a person can sign in on, said only for people who can sign in.
  const devices = devicesQ.data?.data ?? [];
  const deviceCount = (s: Staff) => (s.status === "active" && devicesQ.data ? devicesForStaff(devices, s).count : null);
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


  const primary: PagePrimary = { label: t("team.invite"), onClick: () => router.push("/settings/team/new") };

  /* Role and venue are the two cuts a manager makes of this list, and they live
     behind the one Filters button. Each control is defined once, here; the bar
     draws it in a popover on a desktop and in a sheet on a phone. */
  const filters: FilterSpec[] = [
    {
      key: "role",
      label: t("team.filterRole"),
      active: roleId ? roleName(roleId) : null,
      onClear: () => setRoleId(""),
      control: (
        <Select
          aria-label={t("team.filterRole")}
          value={roleId}
          onChange={setRoleId}
          options={[{ value: "", label: t("team.anyRole") }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
        />
      ),
    },
    {
      key: "location",
      label: t("team.filterLocation"),
      active: locationId ? (locations.find((l) => l.id === locationId)?.name ?? null) : null,
      onClear: () => setLocationId(""),
      control: (
        <Select
          aria-label={t("team.filterLocation")}
          value={locationId}
          onChange={setLocationId}
          options={[
            { value: "", label: t("team.anyLocation") },
            ...locations.filter((l) => l.status !== "archived").map((l) => ({ value: l.id, label: l.name })),
          ]}
        />
      ),
    },
  ];
  /* "Blocked", as the tab says it — not the generic record word. */
  const statusWord = (s: Staff) => (s.status === "suspended" ? t("team.tab.suspended") : t("team.tab.invited"));

  return (
    <PageShell title={t("team.title")} description={t("team.description")} primary={primary}>
      <div className="flex max-w-5xl flex-col gap-section pb-hero">
        {/* The first toolbar: the views, with the create button at the right of the
            same rule. A list has no header row above it for the button. */}
        <PageToolbar underline primary={primary}>
          <Tabs
            items={TABS.map((v) => ({ value: v, label: t(`team.tab.${v}`), count: counts[v] }))}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </PageToolbar>
        {!staffQ.data ? (
          <SectionSkeleton />
        ) : (
          <RecordList
            label={t("team.title")}
            header={
              <div className="border-b border-hairline px-card py-tight">
                <FilterBar
                  search={
                    <SearchField value={search} onChange={setSearch} label={t("team.searchLabel")} placeholder={t("team.searchPlaceholder")} />
                  }
                  filters={filters}
                />
                {/* The count of what is showing, for a screen reader: the chips
                    say what is set, this says what that did. */}
                <p className="sr-only" aria-live="polite">
                  {filtering ? t("team.showing", { count: rows.length }) : ""}
                </p>
              </div>
            }
          >
            {rows.length === 0 ? (
              <li className="px-card py-wide text-center text-sm text-muted">{filtering ? t("team.noMatch") : t("team.emptyTab")}</li>
            ) : (
              rows.map((s) => {
                const isYou = s.id === DEMO_STAFF_ID;
                const nowhere = s.locationIds.length === 0;
                const devs = deviceCount(s);
                return (
                  <RecordRow
                    key={s.id}
                    href={`/settings/team/${s.id}`}
                    leading={<Avatar name={s.name} size={36} soft />}
                    title={s.name}
                    badges={
                      <>
                        {isYou ? (
                          <span className="rounded-xs bg-muted-wash px-tight text-[0.75rem] font-medium text-muted">{t("team.you")}</span>
                        ) : null}
                        {s.status !== "active" ? <StatusPill status={s.status}>{statusWord(s)}</StatusPill> : null}
                      </>
                    }
                    meta={
                      <span className="block truncate">
                        {roleName(s.roleId)} · <span className={cn(nowhere ? "text-warning" : undefined)}>{workplace(s)}</span>
                        <span className="hidden md:inline"> · {s.email ?? s.phone}</span>
                      </span>
                    }
                    columns={
                      <>
                        <span className="hidden w-44 text-right text-[13px] text-muted lg:block">{activity(s)}</span>
                        <span className="hidden w-20 text-right text-[13px] text-muted xl:block">
                          {devs !== null ? t("team.deviceCount", { count: devs }) : ""}
                        </span>
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
