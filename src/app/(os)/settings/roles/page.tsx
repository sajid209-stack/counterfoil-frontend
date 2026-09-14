"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, UserCog } from "lucide-react";
import { Button, PageShell } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { listRoles, listStaff } from "@/lib/api";
import { IconTile, RecordList, RecordRow, SectionSkeleton } from "../_components/SettingsKit";
import { countByRole, useRoleSummary } from "../_lib/roles";
import { RoleMatrix } from "./_components/RoleMatrix";

/**
 * Roles.
 *
 * The list read "Permissions 2 · Refund limit ৳0.00 · Discount limit 10%" —
 * a count, a limit on something the role could not do, and no way to tell what
 * the two permissions were. Each role now says what it lets someone do, in
 * words, and how many people hold it; beneath the list every role is laid side
 * by side, because "what changes between these two?" is the question this page
 * is opened to answer.
 */
export default function RolesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const summary = useRoleSummary();
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const roles = rolesQ.data?.data ?? [];
  const counts = countByRole(staffQ.data?.data ?? []);

  return (
    <PageShell
      title={t("roles.title")}
      description={t("roles.description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => router.push("/settings/roles/new")}>
          {t("roles.newRole")}
        </Button>
      }
    >
      {rolesQ.loading || staffQ.loading ? (
        <SectionSkeleton />
      ) : (
        <div className="flex max-w-4xl flex-col gap-wide pb-hero">
          <RecordList label={t("roles.title")}>
            {roles.map((r) => (
              <RecordRow
                key={r.id}
                href={`/settings/roles/${r.id}`}
                leading={<IconTile icon={UserCog} />}
                title={r.name}
                meta={summary(r)}
                aside={t("roles.peopleCount", { count: counts[r.id] ?? 0 })}
              />
            ))}
          </RecordList>
          <RoleMatrix roles={roles} />
        </div>
      )}
    </PageShell>
  );
}
