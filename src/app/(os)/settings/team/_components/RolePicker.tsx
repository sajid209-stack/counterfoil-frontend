"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
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
    <div role="radiogroup" aria-label={t("common.role")} className="flex flex-col gap-tight px-major py-section">
      {roles.map((r) => {
        const checked = r.id === value;
        return (
          <label
            key={r.id}
            className={cn(
              "flex cursor-pointer items-start gap-comfortable rounded-md border px-section py-comfortable transition-colors duration-quick",
              checked ? "border-ember-solid bg-ember/5" : "border-line hover:bg-subtle/60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={r.id}
              checked={checked}
              onChange={() => onChange(r.id)}
              className="mt-[3px] h-4 w-4 shrink-0 accent-ember"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-section gap-y-inline">
                <span className="text-sm font-medium text-fg">{r.name}</span>
                <span className="text-[13px] text-muted">{t("roles.peopleCount", { count: staffCounts[r.id] ?? 0 })}</span>
              </span>
              <span className="mt-inline block text-[13px] leading-relaxed text-muted">{summary(r)}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
