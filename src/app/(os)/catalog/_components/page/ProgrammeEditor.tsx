"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { Button, FormField, Tabs, TimeInput, controlClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { timeForEvent } from "@/lib/duration";
import { formatClock, formatDay } from "@/lib/format";
import { toMinutes } from "@/lib/schedule";
import type { EventDay } from "@/lib/api/events";
import type { ProductPage } from "@/lib/api/types";
import type { EditorCtx } from "./SectionEditors";
import { AddButton, Note, PortraitField, RemoveButton } from "./editorParts";
import { newId } from "./pageOps";

type Entry = ProductPage["lineup"][number];

const clockMinutes = (hhmm: string | undefined): number | null => (hhmm && /^\d{1,2}:\d{2}/.test(hhmm) ? toMinutes(hhmm) : null);

/**
 * A time typed for the programme. It reads what was typed against the event's
 * own start ("6:00" on a 6 PM event is 6 PM; an explicit "6:00 am" is obeyed)
 * and says what it understood while the operator types, so a wrong reading is
 * seen before it is stored. The stored value is always the 24-hour "HH:MM".
 */
function ClockField({ value, startMinutes, label, placeholder, onChange }: { value: string; startMinutes: number | null; label: string; placeholder: string; onChange: (hhmm: string) => void }) {
  const t = useTranslations("catalog.page");
  const echoId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const typed = draft !== null && draft.trim() !== "";
  const read = typed ? timeForEvent(draft, startMinutes) : null;
  const bad = typed && read === null;
  const commit = () => {
    if (draft !== null && (read !== null || !typed)) onChange(read ?? "");
    setDraft(null);
  };
  return (
    <div className="flex min-w-0 flex-col gap-inline">
      <input
        value={draft ?? (value ? formatClock(value) : "")}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        aria-label={label}
        aria-invalid={bad || undefined}
        aria-describedby={draft !== null ? echoId : undefined}
        placeholder={placeholder}
        autoComplete="off"
        className={controlClass()}
      />
      {draft !== null && (typed || bad) && (
        <span id={echoId} role="status" className={cn("text-sm", bad ? "text-danger" : "text-muted")}>
          {bad ? t("timeBad") : formatClock(read)}
        </span>
      )}
    </div>
  );
}

/**
 * The programme. One day is a plain list; several days are a tab per day,
 * labelled with its date, and each day has its own name, hours and sessions.
 *
 * A session is one compact row: the time, the title, and an optional line. The
 * old Kind dropdown is tucked into a single "person" toggle on the row: a
 * session shows in the schedule only, a person also shows in the line-up (and
 * can carry a photo). New rows are sessions; older entries stay what they were.
 */
export function ProgrammeBody({ ctx }: { ctx: EditorCtx }) {
  const t = useTranslations("catalog.page");
  const { product, page, onChange } = ctx;
  const [openDay, setOpenDay] = useState(0);
  const days: EventDay[] = product.event?.days ?? [];
  const multi = days.length > 1;
  const active = multi ? days[Math.min(openDay, days.length - 1)] : null;

  /* An entry written before the event had days sits on the first day. */
  const onDay = (l: Entry, d: EventDay) => (l.dayId ? l.dayId === d.id : d.id === days[0].id);
  const shown = active ? page.lineup.filter((l) => onDay(l, active)) : page.lineup;

  /* What a bare "6:00" is measured against: this day's start, else the event's. */
  const eventClock = product.event?.startsAt?.slice(11, 16);
  const startMinutes = clockMinutes(active?.startTime) ?? clockMinutes(multi ? undefined : days[0]?.startTime) ?? clockMinutes(eventClock);

  const patch = (eid: string, p: Partial<Entry>) => onChange({ lineup: page.lineup.map((l) => (l.id === eid ? { ...l, ...p } : l)) });
  const patchDay = (id: string, p: Partial<EventDay>) => ctx.onDays?.(days.map((d) => (d.id === id ? { ...d, ...p } : d)));
  const nameOf = (l: Entry, i: number) => l.name.trim() || t("entryN", { n: i + 1 });

  return (
    <>
      {multi && (
        <Tabs
          variant="pill"
          aria-label={t("dayTabs")}
          items={days.map((d) => ({ value: d.id, label: formatDay(d.date, { weekday: true }), count: page.lineup.filter((l) => onDay(l, d)).length }))}
          value={active?.id ?? ""}
          onChange={(v) => setOpenDay(Math.max(0, days.findIndex((d) => d.id === v)))}
        />
      )}

      {active && ctx.onDays && (
        <div className="flex flex-col gap-tight">
          <FormField
            label={t("dayName")}
            placeholder={t("dayN", { n: days.indexOf(active) + 1 })}
            value={active.name ?? ""}
            onChange={(e) => patchDay(active.id, { name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-tight">
            <TimeInput picker label={t("dayStarts")} value={active.startTime ?? ""} onChange={(v) => patchDay(active.id, { startTime: v })} />
            <TimeInput picker label={t("dayEnds")} value={active.endTime ?? ""} onChange={(v) => patchDay(active.id, { endTime: v })} />
          </div>
        </div>
      )}

      {shown.length === 0 && <Note>{multi ? t("dayEmpty") : t("lineupEmpty")}</Note>}

      {shown.map((l, i) => {
        const person = (l.kind ?? "person") === "person";
        const name = nameOf(l, i);
        return (
          <div key={l.id} className="flex flex-col gap-tight border-t border-hairline pt-comfortable first:border-t-0 first:pt-0">
            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-tight">
              <ClockField
                value={l.at ?? ""}
                startMinutes={startMinutes}
                label={t("entryTimeFor", { name })}
                placeholder={t("entryTimePlaceholder")}
                onChange={(at) => patch(l.id, { at })}
              />
              <input
                value={l.name}
                onChange={(e) => patch(l.id, { name: e.target.value })}
                aria-label={t("entryName")}
                placeholder={t("entryTitlePlaceholder")}
                autoComplete="off"
                className={controlClass()}
              />
            </div>
            <div className="flex items-center gap-tight">
              <input
                value={l.role ?? ""}
                onChange={(e) => patch(l.id, { role: e.target.value })}
                aria-label={t("entryRole")}
                placeholder={t("entryLinePlaceholder")}
                autoComplete="off"
                className={cn(controlClass(), "min-w-0 flex-1")}
              />
              <Button
                variant="tertiary"
                size="icon"
                aria-pressed={person}
                aria-label={t("entryPerson", { name })}
                title={person ? t("entryPersonOn") : t("entryPersonOff")}
                onClick={() => patch(l.id, { kind: person ? "session" : "person" })}
                className={cn("shrink-0", person ? "bg-muted-wash text-fg" : "text-muted")}
              >
                <UserRound size={15} strokeWidth={1.5} aria-hidden />
              </Button>
              <RemoveButton label={t("removeEntry", { name })} onClick={() => onChange({ lineup: page.lineup.filter((x) => x.id !== l.id) })} />
            </div>
            {person && <PortraitField name={name} url={l.imageUrl} onChange={(imageUrl) => patch(l.id, { imageUrl })} />}
          </div>
        );
      })}

      <AddButton onClick={() => onChange({ lineup: [...page.lineup, { id: newId("l"), name: "", role: "", at: "", kind: "session", dayId: active?.id }] })}>
        {t("addEntry")}
      </AddButton>
    </>
  );
}
