"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { addCustomerNote, type Customer } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { useSince } from "@/app/(os)/settings/_lib/time";
import { Panel } from "./Panel";

/** Who is acting. Real auth lands with the backend; until then the counter
 *  manager is the actor, exactly as the rest of OS assumes. */
const ACTOR = "Nadia Islam";

/** Notes shown before "Show all" — the newest few are the ones that matter. */
const SHOWN = 3;

/**
 * What staff know about this person.
 *
 * Pinned high on the page because a note is the one thing on a record written
 * for the next person who serves them. The field to write one is right here,
 * above the list; the newest note is first.
 */
export function NotesCard({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const since = useSince();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [all, setAll] = useState(false);

  const notes = [...customer.notes].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const shown = all ? notes : notes.slice(0, SHOWN);
  const now = demoNow().getTime();

  const add = async () => {
    if (!text.trim()) {
      setError(t("noteEmpty"));
      return;
    }
    setSaving(true);
    const res = await addCustomerNote(customer.id, text, ACTOR);
    setSaving(false);
    if (!res.ok) {
      setError(res.error.fieldErrors?.text ?? res.error.message);
      return;
    }
    setText("");
    setError(undefined);
    toast.success(t("noteAdded"));
    onChanged();
  };

  return (
    <Panel title={t("notesTitle")}>
      <div className="flex flex-col gap-tight">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(undefined);
          }}
          aria-label={t("addNote")}
          aria-invalid={error ? true : undefined}
          aria-describedby="note-help"
          placeholder={t("addNote")}
          className={cn(
            "w-full resize-y rounded-sm border bg-card px-comfortable py-tight text-sm outline-none transition-colors duration-quick placeholder:text-faint",
            error ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
          )}
        />
        {error && (
          <p role="alert" className="text-[0.8125rem] text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-section gap-y-tight">
          <p id="note-help" className="min-w-0 flex-1 basis-48 text-[0.8125rem] text-muted">
            {t("noteHelp")}
          </p>
          <Button onClick={add} loading={saving}>
            {t("saveNote")}
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        null
      ) : (
        <>
          <ul className="mt-section flex flex-col border-t border-hairline">
            {shown.map((n, i) => (
              <li key={`${n.at}-${i}`} className="border-b border-hairline py-comfortable last:border-0">
                <p className="whitespace-pre-line break-words text-sm text-fg">{n.text}</p>
                <p className="mt-inline text-[0.8125rem] text-muted">
                  {n.who} · {Date.parse(n.at) > now ? t("justNow") : since(n.at)}
                  <span className="sr-only"> ({formatDateTime(n.at)})</span>
                </p>
              </li>
            ))}
          </ul>
          {notes.length > SHOWN && (
            <Button variant="tertiary" size="sm" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? t("showFewerNotes") : t("showAllNotes", { count: notes.length })}
            </Button>
          )}
        </>
      )}
    </Panel>
  );
}
