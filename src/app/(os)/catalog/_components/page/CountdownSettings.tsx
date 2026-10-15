"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DateField, FormField, RadioGroup, Switch, TimeInput } from "@/components/ui";
import { formatClock, formatDay } from "@/lib/format";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import type { PageCountdown, Product, ProductPage } from "@/lib/api/types";
import { countdownMode, firstDayOf, joinMoment, setCountdown, splitMoment } from "./pageOps";

/** A moment for a person: "Sat 24 Oct, 4:00 PM". Both parts are the operator's own wall clock. */
const momentText = (date: string, time: string) => `${formatDay(date, { weekday: true })}, ${formatClock(time)}`;

/**
 * "Show a countdown": off, to the first day (only a booking that has one is
 * offered it — otherwise it is not shown at all, not greyed out), or to a date
 * and time chosen here. Turning it on adds the Countdown section to the page;
 * Off takes it out. A live line under the choice says exactly what the page
 * will show.
 */
export function CountdownSettings({ product, page, onPage }: { product: Product; page: ProductPage; onPage: (next: ProductPage) => void }) {
  const t = useTranslations("catalog.page.countdown");
  const tc = useTranslations("common");
  /* The demo's clock, the one the date picker below counts days from: the real
     clock would call a date "already passed" that the picker still offers. */
  const [now] = useState(() => demoNow().getTime());
  const [draftTime, setDraftTime] = useState("");

  const first = firstDayOf(product);
  const mode = countdownMode(product, page);
  const c: PageCountdown = page.countdown ?? { mode, hideAtZero: true };
  const hideAtZero = c.hideAtZero !== false;
  /* The mode travels with every change: a page saved without countdown settings
     reads as "to the first day" for a dated booking, and a label edited on it
     must not quietly turn that into Off. */
  const set = (patch: Partial<PageCountdown>) => onPage(setCountdown(page, { mode, ...patch }));

  const stored = splitMoment(c.at);
  const date = stored.date;
  const time = stored.time || draftTime;

  const options = [
    { value: "off", label: t("off") },
    ...(first ? [{ value: "start", label: t("start"), description: t("startHelp") }] : []),
    { value: "date", label: t("date"), description: t("dateHelp") },
  ];

  /* What the page will show, in words, as soon as it can be said. */
  let statement: string | null = null;
  let target: number | null = null;
  if (mode === "start" && first) {
    const d = splitMoment(first);
    statement = t("willCount", { when: momentText(d.date, d.time) });
    target = new Date(first).getTime();
  } else if (mode === "date") {
    if (date && stored.time) {
      statement = t("willCount", { when: momentText(date, stored.time) });
      target = new Date(c.at as string).getTime();
    } else statement = t("needMoment");
  }
  const passed = target !== null && !Number.isNaN(target) && target <= now;

  return (
    <div id="page-countdown" className="flex flex-col gap-tight scroll-mt-24">
      <h3 className="text-md font-semibold text-fg">{t("title")}</h3>
      <RadioGroup
        name="page-countdown-mode"
        aria-label={t("show")}
        options={options}
        value={mode}
        onChange={(v) => set({ mode: v as PageCountdown["mode"] })}
      />

      {mode !== "off" && (
        <div className="flex flex-col gap-comfortable rounded-inner bg-subtle p-comfortable">
          {mode === "date" && (
            <div className="grid gap-tight">
              <DateField
                size="form"
                value={date || null}
                today={DEMO_TODAY}
                min={DEMO_TODAY}
                placeholder={t("pickDate")}
                labels={{ previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") }}
                onChange={(v) => set({ at: joinMoment(v, time || "09:00") })}
              />
              <TimeInput
                picker
                label={t("time")}
                value={time}
                onChange={(v) => {
                  if (date) set({ at: joinMoment(date, v) });
                  else setDraftTime(v);
                }}
              />
            </div>
          )}

          <FormField
            label={t("label")}
            help={t("labelHelp")}
            placeholder={mode === "start" ? t("labelStart") : t("labelDate")}
            value={c.label ?? ""}
            onChange={(e) => set({ label: e.target.value })}
          />

          <Switch
            checked={hideAtZero}
            onChange={(v) => set({ hideAtZero: v })}
            label={t("hide")}
            description={hideAtZero ? t("hideOn") : t("hideOff")}
          />

          {statement && (
            <p role="status" className="text-sm font-medium text-fg">
              {statement}
              {passed && <span className="mt-inline block font-normal text-muted">{hideAtZero ? t("passedHidden") : t("passedShown")}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
