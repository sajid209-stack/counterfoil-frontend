"use client";

import { useTranslations } from "next-intl";
import { controlClass, FormField } from "@/components/ui";
import type { MembershipMember } from "@/lib/api";
import { StepCard } from "./StepCard";

/** Step 3: when it starts, and who it covers when the plan is for more than one person. */
export function DetailsStep({
  start,
  onStart,
  max,
  people,
  onPeople,
}: {
  start: string;
  onStart: (iso: string) => void;
  /** How many people the chosen plan covers; 1 hides the people rows. */
  max: number;
  /** One entry per seat, already filled with defaults. */
  people: MembershipMember[];
  onPeople: (next: MembershipMember[]) => void;
}) {
  const t = useTranslations("membershipDetail.new.details");

  const set = (i: number, patch: Partial<MembershipMember>) => onPeople(people.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <StepCard n={3} title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-section">
        <div className="max-w-xs">
          <FormField variant="date" label={t("starts")} value={start} onChange={(e) => e.target.value && onStart(e.target.value)} />
        </div>

        {max > 1 && (
          <fieldset className="flex min-w-0 flex-col gap-comfortable">
            <legend className="text-sm font-medium text-muted">{t("people")}</legend>
            <p className="text-sm text-muted">{t("peopleHelp", { max })}</p>
            <ul className="flex flex-col gap-comfortable">
              {people.map((p, i) => (
                <li key={i} className="flex min-w-0 flex-col gap-tight sm:flex-row">
                  <input
                    className={controlClass()}
                    value={p.name}
                    aria-label={`${t("person", { n: i + 1 })}: ${t("personName")}`}
                    placeholder={t("personName")}
                    onChange={(e) => set(i, { name: e.target.value })}
                  />
                  <input
                    className={controlClass()}
                    value={p.note ?? ""}
                    aria-label={`${t("person", { n: i + 1 })}: ${t("personNote")}`}
                    placeholder={t("personNote")}
                    onChange={(e) => set(i, { note: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        )}
      </div>
    </StepCard>
  );
}
