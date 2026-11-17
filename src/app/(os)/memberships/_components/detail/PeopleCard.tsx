"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Card, controlClass } from "@/components/ui";
import type { MembershipMember } from "@/lib/api";
import { MemberAvatar } from "../shared";

/**
 * The named people a family or group membership covers. Read as a list; "Edit"
 * turns the rows into inputs, held in a draft until Save, so Cancel puts them
 * back exactly as they were.
 */
export function PeopleCard({
  members,
  max,
  saving,
  onSave,
}: {
  members: MembershipMember[];
  max: number;
  saving: boolean;
  onSave: (next: MembershipMember[]) => void;
}) {
  const t = useTranslations("membershipDetail.people");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState<MembershipMember[] | null>(null);
  const editing = draft !== null;
  const rows = draft ?? members;

  const set = (i: number, patch: Partial<MembershipMember>) =>
    setDraft((cur) => (cur ?? members).map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const save = () => {
    const clean = (draft ?? [])
      .map((m) => ({ name: m.name.trim(), note: m.note?.trim() || undefined }))
      .filter((m) => m.name);
    onSave(clean);
    setDraft(null);
  };

  return (
    <Card
      title={t("title")}
      actions={
        <>
          <span className="text-sm text-muted">{t("count", { count: rows.length, max })}</span>
          {!editing && (
            <Button size="sm" variant="secondary" onClick={() => setDraft(members.map((m) => ({ ...m })))}>
              {tc("edit")}
            </Button>
          )}
        </>
      }
    >
      {!editing ? (
        rows.length === 0 ? (
          <p className="text-sm text-muted">{t("none")}</p>
        ) : (
          <ul className="flex flex-col gap-comfortable">
            {rows.map((m, i) => (
              <li key={i} className="flex min-w-0 items-center gap-comfortable">
                <MemberAvatar name={m.name} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-base font-medium text-fg">{m.name}</span>
                  {m.note && <span className="block break-words text-sm text-muted">{m.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="flex flex-col gap-comfortable">
          <ul className="flex flex-col gap-comfortable">
            {rows.map((m, i) => (
              <li key={i} className="flex items-start gap-tight">
                <div className="flex min-w-0 flex-1 flex-col gap-tight sm:flex-row">
                  <input
                    className={controlClass()}
                    value={m.name}
                    aria-label={`${t("name")} ${i + 1}`}
                    placeholder={t("name")}
                    onChange={(e) => set(i, { name: e.target.value })}
                  />
                  <input
                    className={controlClass()}
                    value={m.note ?? ""}
                    aria-label={`${t("note")} ${i + 1}`}
                    placeholder={t("note")}
                    onChange={(e) => set(i, { note: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={t("remove", { n: i + 1 })}
                  onClick={() => setDraft((cur) => (cur ?? members).filter((_, j) => j !== i))}
                  className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:size-9"
                >
                  <X size={16} strokeWidth={1.5} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {rows.length < max ? (
            <div>
              <Button size="sm" variant="tertiary" icon={<Plus size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setDraft((cur) => [...(cur ?? members), { name: "" }])}>
                {t("add")}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">{t("full", { max })}</p>
          )}
          <div className="flex justify-end gap-tight">
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={save} loading={saving}>
              {tc("save")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
