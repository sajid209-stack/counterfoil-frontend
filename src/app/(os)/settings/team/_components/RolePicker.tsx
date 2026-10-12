"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Radio } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/api";
import { useRoleSummary } from "../../_lib/roles";

/**
 * Choosing a role — with what the role allows written beside it.
 *
 * It was a bare select of role names, which leaves the person inviting someone
 * to guess what "Supervisor" means or to leave the page and find out. Stating
 * each role's powers where it is assigned means the choice is made on what the
 * person will be able to do rather than on a job title.
 */
export function RolePicker({
  roles,
  value,
  onChange,
  staffCounts,
}: {
  roles: Role[];
  value: string;
  onChange: (roleId: string) => void;
  /** People per role, so each choice can say how many already hold it. */
  staffCounts: Record<string, number>;
}) {
  const t = useTranslations("settings");
  const summary = useRoleSummary();
  const name = useId();

  return (
    <div role="radiogroup" aria-label={t("common.role")} className="flex flex-col gap-tight px-card py-section">
      {roles.map((r) => {
        const checked = r.id === value;
        return (
          // The tile is the target; the kit Radio inside is the control.
          <div
            key={r.id}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("label,input")) return;
              onChange(r.id);
            }}
            className={cn(
              "cursor-pointer rounded-control px-tight transition-colors duration-quick",
              checked ? "bg-card ring-2 ring-inset ring-ember-solid" : "bg-muted-wash hover:bg-muted-wash",
            )}
          >
            <Radio
              name={name}
              value={r.id}
              checked={checked}
              onChange={() => onChange(r.id)}
              label={
                <span className="flex flex-wrap items-baseline justify-between gap-x-section gap-y-inline">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm text-muted">{t("roles.peopleCount", { count: staffCounts[r.id] ?? 0 })}</span>
                </span>
              }
              description={summary(r)}
            />
          </div>
        );
      })}
    </div>
  );
}
