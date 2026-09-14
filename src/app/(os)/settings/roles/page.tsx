"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Copy, Plus, Trash2, UserCog } from "lucide-react";
import { ActionMenu, Button, ConfirmDialog, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createRole, deleteRole, listRoles, listStaff, type Role } from "@/lib/api";
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
 *
 * The next most common job is "a Cashier, but who can refund" — so each role
 * can be duplicated from its row. A role can be deleted only while nobody holds
 * it; the menu says how many people are in the way rather than offering a
 * delete that would strand them without a role.
 */
export default function RolesPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const toast = useToast();
  const summary = useRoleSummary();
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const staffQ = useApiQuery(() => listStaff({ pageSize: 500 }), []);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  const roles = rolesQ.data?.data ?? [];
  const counts = countByRole(staffQ.data?.data ?? []);

  const duplicate = async (r: Role) => {
    setBusy(true);
    const res = await createRole({
      name: t("roles.copyOf", { name: r.name }),
      permissions: [...r.permissions],
      refundLimit: r.refundLimit,
      discountLimitPct: r.discountLimitPct,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("roles.duplicated", { name: r.name }));
    router.push(`/settings/roles/${res.data.id}`);
  };

  const remove = async (r: Role) => {
    setBusy(true);
    const res = await deleteRole(r.id);
    setBusy(false);
    setDeleting(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("roles.deleted", { name: r.name }));
    rolesQ.reload();
  };

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
      {!rolesQ.data || !staffQ.data ? (
        <SectionSkeleton />
      ) : (
        <div className="flex max-w-4xl flex-col gap-wide pb-hero">
          <RecordList label={t("roles.title")}>
            {roles.map((r) => {
              const held = counts[r.id] ?? 0;
              return (
                <RecordRow
                  key={r.id}
                  href={`/settings/roles/${r.id}`}
                  leading={<IconTile icon={UserCog} />}
                  title={r.name}
                  meta={
                    <>
                      <span className="block">{summary(r)}</span>
                      <span className="block">{t("roles.peopleCount", { count: held })}</span>
                    </>
                  }
                  menu={
                    <ActionMenu
                      label={t("roles.actionsFor", { name: r.name })}
                      items={[
                        {
                          key: "duplicate",
                          label: t("roles.duplicate"),
                          icon: <Copy size={16} strokeWidth={1.5} />,
                          disabled: busy,
                          onSelect: () => duplicate(r),
                        },
                        {
                          key: "delete",
                          label: held > 0 ? t("roles.deleteBlocked", { count: held }) : t("roles.delete"),
                          icon: <Trash2 size={16} strokeWidth={1.5} />,
                          destructive: true,
                          disabled: held > 0,
                          onSelect: () => setDeleting(r),
                        },
                      ]}
                    />
                  }
                />
              );
            })}
          </RecordList>
          <RoleMatrix roles={roles} />
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting);
        }}
        title={deleting ? t("roles.deleteTitle", { name: deleting.name }) : ""}
        message={t("roles.deleteBody")}
        confirmLabel={t("roles.delete")}
        loading={busy}
      />
    </PageShell>
  );
}
