"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Notice, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listDevices, listLocations, listRoles, listStaff } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { setActiveCounter, useActiveCounter } from "@/lib/activeCounter";
import { useActiveLocation } from "@/lib/activeLocation";
import { SectionSkeleton } from "../_components/SettingsKit";
import { buildAssignments } from "../_lib/assignments";
import { AssignmentsView } from "./_components/AssignmentsView";

/**
 * Where the signed-in person works and what they can do there.
 *
 * Profile used to list venue and counter names as two bare facts, which said
 * where and nothing else. This is the page that answers the rest, and it only
 * reads: assignments are a manager's to set, so the way to change them is a
 * link, never a control here. The rules live in `buildAssignments`; the view
 * only draws what it is handed.
 */
export default function AssignmentsPage() {
  const t = useTranslations("settings.assignments");
  const router = useRouter();
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const devicesQ = useApiQuery(() => listDevices({ pageSize: 100 }), []);

  const me = meQ.data;
  const roles = useMemo(() => rolesQ.data?.data ?? [], [rolesQ.data]);
  const staff = useMemo(() => staffQ.data?.data ?? [], [staffQ.data]);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const counters = useMemo(() => countersQ.data?.data ?? [], [countersQ.data]);
  const devices = useMemo(() => devicesQ.data?.data ?? [], [devicesQ.data]);

  const activeLocation = useActiveLocation(locations);
  const thisTill = useActiveCounter(counters);

  const queries = [meQ, rolesQ, staffQ, locationsQ, countersQ, devicesQ];
  const failed = queries.some((q) => q.error);
  const ready = !!me && queries.every((q) => q.data);

  const assignments = useMemo(
    () =>
      me && ready
        ? buildAssignments({
            me,
            role: roles.find((r) => r.id === me.roleId),
            roles,
            staff,
            locations,
            counters,
            devices,
            currentLocationId: activeLocation.id || undefined,
          })
        : null,
    [me, ready, roles, staff, locations, counters, devices, activeLocation.id],
  );

  const openTill = (counterId: string) => {
    setActiveCounter(counterId);
    router.push("/pos");
  };

  return (
    <PageShell title={t("title")} description={t("description")}>
      {failed ? (
        <Notice
          tone="danger"
          title={t("errorTitle")}
          action={{ label: t("retry"), onClick: () => queries.forEach((q) => q.error && q.reload()), variant: "button" }}
        >
          {t("errorBody")}
        </Notice>
      ) : me && assignments ? (
        <AssignmentsView
          me={me}
          role={roles.find((r) => r.id === me.roleId)}
          assignments={assignments}
          thisTillId={thisTill.counter?.id ?? ""}
          onOpenTill={openTill}
        />
      ) : (
        <SectionSkeleton />
      )}
    </PageShell>
  );
}
