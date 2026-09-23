"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, ChevronRight, Circle, Maximize2 } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createEvent, listLocations, slugify, type Channel, type EventCustomisation, type EventRecord } from "@/lib/api";
import { useApiQuery } from "@/lib/useApi";
import { CATEGORIES, categoryById, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { formatDay, formatPriceShort } from "@/lib/format";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { emptyTier, TicketTiers, toTiers, type FormTier } from "./TicketTiers";
import { EventCanvas } from "./EventCanvas";
import { EventArchitect, type EventContent } from "./EventArchitect";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { WhereSold } from "../WhereSold";
import type { SectionId } from "@/lib/events/catalog";

/** Where a check sends you: the making pane, or the page designer. */
type Pane = "make" | "design";
type StepKey = "details" | "design" | "tickets";

const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** An end, where one was set: the day and time it finishes, with a finish
 *  before the start on the same day read as past midnight. */
export function endsAtOf(c: Pick<EventContent, "date" | "startTime" | "endDate" | "endTime">): string | undefined {
  if (!c.endTime || !c.date) return undefined;
  let day = c.endDate || c.date;
  if (day === c.date && c.endTime <= c.startTime) day = shiftDay(c.date, 1);
  return `${day}T${c.endTime}:00+06:00`;
}

/**
 * Create an event.
 *
 * The research bar is Luma's — a good-looking page from minimal input, in about
 * two minutes — and the warning is Eventbrite's, which reviewers call
 * "functional but clunky". Both point the same way: the steps are only
 * acceptable if most of them are nearly free.
 *
 * So the facts come first and on their own — name, date, venue — because they
 * are what a box office changes most and they are not a design decision. The
 * look then arrives pre-answered by the category: its theme, its accent, its
 * typefaces, its section order and its layout. The tickets step opens with one
 * row. And beside the form, like the booking wizard, the event as it stands and
 * what it still needs before it can go on sale.
 */
export function EventWizard({ initialCategory = null }: { initialCategory?: CategoryId | null } = {}) {
  const t = useTranslations("events");
  const tw = useTranslations("catalog.eventWizard");
  const tb = useTranslations("catalog.wizard");
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);

  /* Arriving from the chooser the category — and with it the whole look — is
     already picked, so there is no category step at all; the "Change" beside
     what is being added goes back to the chooser for a change of mind. */
  const [pane, setPane] = useState<Pane>("make");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [bigPreview, setBigPreview] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Where it is sold: its own page by default, the counter when asked for.
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const locations = useMemo(() => locationsQ.data?.data ?? [], [locationsQ.data]);
  const [counter, setCounter] = useState(false);
  const [online, setOnline] = useState(true);
  const [picked, setPicked] = useState<string[] | null>(null);
  /* One venue is the answer without asking; with several, nothing is chosen
     for the operator. */
  const locationIds = picked ?? (locations.length === 1 ? [locations[0].id] : []);
  const toggleLocation = (id: string) => setPicked(locationIds.includes(id) ? locationIds.filter((x) => x !== id) : [...locationIds, id]);

  const [categoryId, setCategoryId] = useState<CategoryId | null>(initialCategory);
  const [subtype, setSubtype] = useState("");
  const [custom, setCustom] = useState<EventCustomisation | null>(() => {
    if (!initialCategory) return null;
    const cat = categoryById(initialCategory);
    return { accent: cat.theme.accent, displayFont: cat.theme.display, bodyFont: cat.theme.body, variant: cat.variants[0], sections: cat.sections };
  });

  const [content, setContent] = useState<EventContent>({
    title: "",
    subtitle: "",
    /* The date is prefilled, not blank. The preview has to draw SOME day —
       a page with no date and a countdown to nothing looks broken — and a
       preview stating a date while the field beside it reads "Pick a date" is
       the screen contradicting itself about the one fact a guest acts on.
       So the field holds the day the page draws, from the first render, where
       it can be seen and changed. The time has always worked this way. */
    date: shiftDay(DEMO_TODAY, 14),
    startTime: "19:00",
    endDate: "",
    endTime: "",
    venueName: "",
    venueAddress: "",
    description: "",
    coverUrl: "",
    videoUrl: "",
    organiserName: "",
    organiserBlurb: "",
    lineup: [],
    faq: [],
  });
  const patchContent = (patch: Partial<EventContent>) => {
    setContent((c) => ({ ...c, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k.startsWith("end") ? "ends" : k];
      return next;
    });
  };
  /* Overrides for the content a CATEGORY seeds — stats, highlights, the info
     trio. Held apart from `content` and cleared when the category changes, so
     switching from a gallery to a rave does not carry "Open Tue–Sun" across. */
  const [seedEdits, setSeedEdits] = useState<Partial<EventRecord>>({});
  const patchDraft = (patch: Partial<EventRecord>) => setSeedEdits((e) => ({ ...e, ...patch }));
  const [tiers, setTiers] = useState<FormTier[]>(() => [emptyTier(t("tickets.namePlaceholder"))]);

  /* A check is a place, not a step: name, date and venue are on the card,
     tickets are under it, and the page's sample content is in the designer.
     Pressing one goes there and puts the cursor on it rather than walking a
     wizard forward one screen at a time. */
  const goTo = (key: StepKey) => {
    setStepError(null);
    setPane(key === "design" ? "design" : "make");
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-goto="${key}"]`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.querySelector<HTMLElement>("input, button, select")?.focus?.();
    });
  };

  /** Choosing a category is also choosing its whole visual default. */
  const pickCategory = (id: CategoryId) => {
    const cat = categoryById(id);
    setCategoryId(id);
    setSubtype("");
    // A gallery's opening hours have no business surviving a switch to a rave.
    setSeedEdits({});
    setCustom({
      accent: cat.theme.accent,
      displayFont: cat.theme.display,
      bodyFont: cat.theme.body,
      variant: cat.variants[0],
      sections: cat.sections,
    });
    setPane("make");
  };

  const labels = useTemplateLabels(categoryId);
  /* The field is prefilled, so this is only a guard against it being cleared. */
  const shownDate = content.date || shiftDay(DEMO_TODAY, 14);

  /** The record the preview draws — the real shape, so the preview cannot
   *  diverge from what gets saved. Placeholders stand in only while a field is
   *  still empty, so the page never looks broken mid-wizard. */
  const draft: EventRecord | null = useMemo(() => {
    if (!categoryId || !custom) return null;
    return {
      id: "draft",
      status: "active",
      published: false,
      slug: slugify(content.title || subtype || "event"),
      title: content.title.trim() || t("placeholder.title"),
      subtitle: content.subtitle.trim() || undefined,
      categoryId,
      subtype: subtype ? t(`subtype.${subtype}`) : t(`category.${categoryId}`),
      startsAt: `${shownDate}T${content.startTime}:00+06:00`,
      endsAt: endsAtOf({ ...content, date: shownDate }),
      venueName: content.venueName.trim() || t("placeholder.venue"),
      venueAddress: content.venueAddress.trim() || undefined,
      description: content.description.trim() || t("placeholder.description"),
      /* The at-a-glance content a category ships with. It is real, specific
         and translated — a gallery states opening hours, a tour states where
         it departs from — because a template whose sample content is lorem
         teaches an operator nothing about what the section is FOR. */
      stats: Array.from({ length: categoryById(categoryId).statCount ?? 3 }, (_, i) => ({
        id: `st${i}`,
        value: t(`defaults.${categoryId}.stat${i}.value`),
        label: t(`defaults.${categoryId}.stat${i}.label`),
      })),
      highlights: [0, 1, 2, 3].map((i) => ({
        id: `hl${i}`,
        label: t(`defaults.${categoryId}.highlight${i}`),
        description:
          categoryById(categoryId).variants[0] === "structured"
            ? t(`defaults.${categoryId}.benefit${i}`)
            : undefined,
      })),
      info: [0, 1, 2].map((i) => ({
        id: `in${i}`,
        label: t(`defaults.${categoryId}.info${i}.label`),
        value: t(`defaults.${categoryId}.info${i}.value`),
      })),
      videoUrl: content.videoUrl.trim() || undefined,
      organiser: content.organiserName.trim()
        ? { name: content.organiserName.trim(), blurb: content.organiserBlurb.trim() || undefined }
        : undefined,
      sponsors: [],
      ...seedEdits,
      // The operator's own bill once there is one; a sample stands in only
      // while the section is still empty, so the preview is never a blank page.
      lineup: content.lineup.filter((l) => l.name.trim()).length
        ? content.lineup.filter((l) => l.name.trim())
        : SAMPLE_LINEUP.map((l, i) => ({ ...l, id: `s${i}`, name: t(`sample.${categoryId}.${i}`) })),
      faq: content.faq.filter((f) => f.q.trim()).length
        ? content.faq.filter((f) => f.q.trim())
        : [{ id: "f1", q: t("placeholder.faqQ"), a: t("placeholder.faqA") }],
      tiers: toTiers(tiers).map((x) => ({ ...x, name: x.name || t("placeholder.tier"), quantity: x.quantity || 100 })),
      customisation: { ...custom, coverUrl: content.coverUrl.trim() || undefined },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  }, [categoryId, custom, content, subtype, tiers, now, t, seedEdits, shownDate]);

  // ── what it needs ─────────────────────────────────────────────────────────
  const detailsErrors = () => {
    const e: Record<string, string> = {};
    if (!content.title.trim()) e.title = t("error.title");
    if (!content.date) e.date = tw("missing.date");
    if (!content.venueName.trim()) e.venueName = t("error.venue");
    const end = endsAtOf(content);
    if (end && content.date && Date.parse(end) <= Date.parse(`${content.date}T${content.startTime}:00+06:00`)) e.ends = tw("missing.ends");
    return e;
  };
  /* A blank price is not a free ticket — it is a price nobody has set. Free
     is a 0, typed, which is what the field's placeholder says. */
  const ticketErrors = () => {
    const e: Record<string, string> = {};
    tiers.forEach((r, i) => {
      if (!r.name.trim()) e[i === 0 ? "tierName" : `tiers.${i}.name`] = t("error.tierName");
      if (r.price.trim() === "") e[`tiers.${i}.price`] = tb("missing.tierPrice");
      if (!r.quantity.trim()) e[i === 0 ? "tierQuantity" : `tiers.${i}.quantity`] = t("error.tierQuantity");
    });
    return e;
  };
  // A venue is asked for only when a counter sells it.
  const channelDone = (counter || online) && (!counter || locationIds.length > 0);
  /* Content a category seeds is real and specific — "16 teams · ৳200,000
     prize pool" — which is exactly why it must not go on sale unread: it is a
     claim about somebody else's event. A seeded section counts until it has
     been edited or switched off. */
  const samples: SectionId[] = custom
    ? ([
        ["stats", "stats"],
        ["highlights", "highlights"],
        ["about", "info"],
      ] as const)
        .filter(([section, field]) => custom.sections.includes(section) && seedEdits[field] === undefined)
        .map(([section]) => section)
    : [];
  const ticketsValid = Object.keys(ticketErrors()).length === 0;
  const unpriced = tiers.find((r) => r.name.trim() && r.price.trim() === "");
  const checks: { key: string; done: boolean; step: StepKey; hint?: string }[] = [
    { key: "name", done: !!content.title.trim(), step: "details" },
    { key: "date", done: !!content.date, step: "details" },
    { key: "venue", done: !!content.venueName.trim(), step: "details" },
    {
      key: "page",
      done: samples.length === 0,
      step: "design",
      hint: samples.length > 0 ? tw("hint.samples", { count: samples.length }) : undefined,
    },
    {
      key: "tickets",
      done: ticketsValid,
      step: "tickets",
      hint: unpriced ? tb("hint.needsPrice", { name: unpriced.name.trim() }) : undefined,
    },
    {
      key: "channel",
      done: channelDone,
      step: "tickets",
      hint: !channelDone ? (counter || online ? tb("hint.needsLocation") : tb("nowhere")) : undefined,
    },
  ];
  const ready = checks.every((c) => c.done);

  /** Mark what is wrong where it is and put the cursor on the first of it. */
  const flag = (e: Record<string, string>) => {
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid] button');
        el?.focus?.();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return false;
    }
    return true;
  };
  const validate = (key: StepKey) => {
    if (key === "details") return flag(detailsErrors());
    if (key === "tickets") {
      const ok = flag(ticketErrors());
      if (!ok) return false;
      if (!counter && !online) { setStepError(tb("nowhere")); return false; }
      if (counter && locationIds.length === 0) {
        setErrors((x) => ({ ...x, locations: tw("missing.counterLocation") }));
        requestAnimationFrame(() => document.querySelector<HTMLElement>('fieldset[aria-invalid="true"] input')?.focus());
        return false;
      }
    }
    return true;
  };


  const publish = async (publishNow: boolean) => {
    if (!draft || !categoryId || !custom) return;
    /* Put on sale is never greyed out: pressed early, it goes to what is
       missing and says so there. Saving off sale only needs the facts. */
    const need = publishNow ? checks.find((c) => !c.done) : !content.title.trim() || !content.date || !content.venueName.trim() ? checks[0] : undefined;
    if (need) {
      goTo(need.step);
      if (need.step === "details") flag(detailsErrors());
      if (need.step === "tickets") validate("tickets");
      if (need.step === "design") setStepError(tw("hint.samples", { count: samples.length }));
      return;
    }
    setSaving(true);
    const res = await createEvent({
      status: "active",
      published: publishNow,
      slug: slugify(content.title),
      title: content.title.trim(),
      subtitle: content.subtitle.trim() || undefined,
      categoryId,
      subtype,
      startsAt: `${content.date}T${content.startTime}:00+06:00`,
      endsAt: endsAtOf(content),
      venueName: content.venueName.trim(),
      venueAddress: content.venueAddress.trim() || undefined,
      description: content.description.trim() || undefined,
      stats: draft?.stats ?? [],
      highlights: draft?.highlights ?? [],
      info: draft?.info ?? [],
      sponsors: draft?.sponsors ?? [],
      videoUrl: draft?.videoUrl,
      organiser: draft?.organiser,
      lineup: content.lineup.filter((l) => l.name.trim()),
      faq: content.faq.filter((f) => f.q.trim()),
      tiers: toTiers(tiers),
      channels: [...(counter ? (["counter"] as Channel[]) : []), ...(online ? (["online"] as Channel[]) : [])],
      locationIds: counter ? locationIds : [],
      customisation: { ...custom, coverUrl: content.coverUrl.trim() || undefined },
    });
    setSaving(false);
    if (res.ok) {
      toast.success(publishNow ? tb("toastOnSale", { name: res.data.title }) : tb("toastDraft", { name: res.data.title }));
      // To the thing just made, not back to a list to find it in.
      router.push(`/catalog/events/${res.data.id}`);
    } else {
      toast.error(res.error.message);
    }
  };

  // ── how it reads ──────────────────────────────────────────────────────────
  const whenText = content.date
    ? [formatDay(content.date, { weekday: true }), content.endTime ? `${content.startTime}–${content.endTime}` : content.startTime].join(" · ") +
      (content.endDate && content.endDate !== content.date ? ` → ${formatDay(content.endDate, { weekday: true })}` : "")
    : null;
  const liveTiers = toTiers(tiers).filter((x) => x.name);
  const capacity = liveTiers.reduce((n, x) => n + x.quantity, 0);
  // "From" is the cheapest price somebody has actually set — never a blank read as free.
  const priced = toTiers(tiers.filter((r) => r.name.trim() && r.price.trim() !== ""));
  const fromPrice = priced.length ? Math.min(...priced.map((x) => x.price)) : null;
  const catName = categoryId ? t(`category.${categoryById(categoryId).key}`) : null;
  return (
    <div className="grid gap-section pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-hero lg:grid-cols-[minmax(0,1fr)_23rem]">
      <Modal open={checklistOpen} onClose={() => setChecklistOpen(false)} title={tb("readyTitle")}>
        <EventChecklist checks={checks} reachable={() => true} onGo={(step) => { setChecklistOpen(false); goTo(step); }} ready={ready} />
      </Modal>
      <Modal open={bigPreview} onClose={() => setBigPreview(false)} title={t("customise.preview")}>
        {draft && (
          <div className={cn("overflow-hidden rounded-sm", templateFontVars)}>
            <PreviewFrame width={1180}>
              <EventTemplate event={draft} device="desktop" labels={labels} now={now} />
            </PreviewFrame>
          </div>
        )}
      </Modal>

      <div className="flex min-w-0 flex-col gap-section">
        {stepError && (
          <p role="alert" tabIndex={-1} data-step-error className="flex items-start gap-tight rounded-sm border border-danger/40 bg-danger-wash px-comfortable py-tight text-[13px] font-medium text-danger outline-none">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
            {stepError}
          </p>
        )}

        {/* ── Which kind, when the chooser did not already say ───────────── */}
        {!categoryId && (
          <div>
            <StepHead title={t("step.categoryTitle")} help={t("step.categoryHelp")} />
            <div className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.id)}
                  aria-pressed={categoryId === c.id}
                  className="group overflow-hidden rounded-md border border-line text-left transition-all duration-quick hover:-translate-y-0.5 hover:border-strong hover:shadow-md"
                >
                  <span className="flex h-28 items-end p-card" style={{ background: c.theme.bg, borderBottom: `1px solid ${c.theme.line}` }}>
                    <span className={templateFontVars} style={{ display: "block" }}>
                      <span
                        style={{
                          display: "block",
                          font: `700 26px/1 ${c.theme.display}, var(--font-hind-siliguri), sans-serif`,
                          letterSpacing: c.theme.displayTracking,
                          color: c.theme.fg,
                          textTransform: c.theme.eyebrowCase === "upper" ? "uppercase" : "none",
                        }}
                      >
                        {t(`category.${c.key}`)}
                      </span>
                      <span style={{ marginTop: 8, display: "block", height: 4, width: 52, background: c.theme.accent, borderRadius: 999 }} />
                    </span>
                  </span>
                  <span className="block bg-card p-card">
                    <span className="block text-[13px] text-muted">{t(`categoryBlurb.${c.key}`)}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {categoryId && custom && (
          <>
            {/* Two panes, not five steps: what the event IS, and what its page
                is made of. Neither is a gate — an event can go on sale from
                either, and the ready list says what is still missing. */}
            <div className="flex flex-wrap items-center justify-between gap-tight">
              <div role="tablist" aria-label={tb("progress")} className="flex gap-inline rounded-sm bg-line/60 p-inline">
                {(["make", "design"] as Pane[]).map((p) => (
                  <button
                    key={p}
                    role="tab"
                    type="button"
                    aria-selected={pane === p}
                    onClick={() => setPane(p)}
                    className={cn(
                      "flex min-h-11 items-center rounded-sm px-comfortable text-[13px] font-medium transition-colors duration-quick sm:min-h-9",
                      pane === p ? "bg-card text-fg shadow-sm" : "text-muted hover:text-fg",
                    )}
                  >
                    {tb(`pane.${p}`)}
                  </button>
                ))}
              </div>
              {/* The kind, as a control rather than a sentence with a link in
                  it — and in ink, not the brand colour: on this screen orange
                  belongs to the one action that puts the event on sale. */}
              <Link
                href="/catalog/new?kind=events"
                title={tb("changeKind")}
                className="inline-flex min-h-11 items-center gap-tight rounded-full border border-line px-comfortable text-[13px] transition-colors duration-quick hover:border-strong md:min-h-9"
              >
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: custom.accent }} />
                <span className="sr-only">{tb("adding")} </span>
                <span className="font-medium">{catName}</span>
                <ChevronRight size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
                <span className="sr-only">{tb("changeKind")}</span>
              </Link>
            </div>

            {pane === "make" ? (
              <>
                <div data-goto="details">
                  <EventCanvas
                    categoryId={categoryId}
                    content={content}
                    onContent={patchContent}
                    errors={errors}
                    accent={custom.accent}
                    displayFont={custom.displayFont}
                    onFont={(css) => setCustom({ ...custom, displayFont: css })}
                    onAccent={(hex) => setCustom({ ...custom, accent: hex })}
                    onCategory={pickCategory}
                    details={draft?.info ?? []}
                    onDetails={(info) => patchDraft({ info })}
                    detailsAreSample={seedEdits.info === undefined}
                  />
                </div>

                <section data-goto="tickets" className="card-surface p-card">
                  <h2 className="text-base font-semibold tracking-[-0.4px]">{tw("title.tickets")}</h2>
                  <p className="mb-section mt-inline text-[13px] text-muted">{t("step.ticketsHelp")}</p>
                  <TicketTiers rows={tiers} onChange={setTiers} errors={errors} />
                  <div className="mt-major border-t border-hairline pt-section">
                    <WhereSold
                      counter={counter}
                      online={online}
                      onCounter={(v) => { setCounter(v); setStepError(null); }}
                      onOnline={(v) => { setOnline(v); setStepError(null); }}
                      onlineHelp={tw("onlineHelp")}
                      counterHelp={tw("counterHelp")}
                      locations={locations}
                      locationIds={locationIds}
                      onToggleLocation={(id) => { toggleLocation(id); setStepError(null); setErrors((x) => ({ ...x, locations: "" })); }}
                      locationsOnlyForCounter
                      error={errors.locations || null}
                    />
                  </div>
                </section>
              </>
            ) : (
              draft && (
                <div data-goto="design">
                  <EventArchitect
                    categoryId={categoryId}
                    event={draft}
                    custom={custom}
                    onCustom={setCustom}
                    content={content}
                    onContent={patchContent}
                    onEvent={patchDraft}
                    now={now}
                    labels={labels}
                    onEditDetails={() => setPane("make")}
                    samples={samples}
                    preview={false}
                  />
                </div>
              )
            )}
          </>
        )}

        {/* ── The one action, pinned on a phone ───────────────────────────── */}
        {categoryId && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-tight border-t border-line bg-surface/95 px-gutter pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-tight backdrop-blur-xl md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none lg:hidden">
            <button
              type="button"
              onClick={() => setChecklistOpen(true)}
              className={cn("flex min-h-11 items-center gap-inline text-[13px] font-medium", ready ? "text-success" : "text-muted")}
            >
              {ready ? <Check size={15} strokeWidth={2} aria-hidden /> : null}
              {ready ? tb("readyShort") : tb("leftShort", { count: checks.filter((c) => !c.done).length })}
              <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
            </button>
            <span className="flex-1" />
            <Button variant="secondary" onClick={() => setBigPreview(true)}>{t("customise.preview")}</Button>
            <Button loading={saving} onClick={() => publish(true)}>{tb("putOnSale")}</Button>
          </div>
        )}
      </div>

      {/* ── The page as it stands, and what stands between it and the box
             office. The preview is a phone because that is what a guest opens,
             and because at this width a desktop page is a thumbnail nobody can
             read. ─────────────────────────────────────────────────────────── */}
      {categoryId && draft && (
        <aside className="hidden h-fit flex-col gap-section lg:sticky lg:top-section lg:flex" aria-label={tw("summaryTitle")}>
          {/* What stands between this and the box office comes FIRST: the
              action has to be on screen, and a full page preview under it is
              1,400px tall. */}
          <div className="card-surface overflow-hidden">
            <div className="border-b border-hairline p-card">
              <p className={cn("break-words text-[16px] font-semibold leading-snug", !content.title.trim() && "text-muted")}>{content.title.trim() || tw("untitled")}</p>
              {whenText && <p className="mt-inline text-[13px]">{whenText}</p>}
              {content.venueName.trim() && <p className="text-[13px] text-muted">{content.venueName.trim()}</p>}
              {capacity > 0 && fromPrice !== null && (
                <p className="mt-tight text-[13px] tabular-nums">
                  {tw("fromAndCap", { price: fromPrice === 0 ? t("free") : formatPriceShort(fromPrice ?? 0), count: capacity.toLocaleString() })}
                </p>
              )}
            </div>
            <div className="p-card">
              <EventChecklist checks={checks} reachable={() => true} onGo={goTo} ready={ready} />
              <div className="mt-section flex flex-col gap-tight">
                <Button loading={saving} onClick={() => publish(true)} className="w-full justify-center">{tb("putOnSale")}</Button>
                <Button variant="secondary" loading={saving} onClick={() => publish(false)} className="w-full justify-center">{tb("saveOffSale")}</Button>
              </div>
              {/* Honest about the one thing the screen cannot promise yet. */}
              <p className="mt-section flex items-start gap-tight text-[12px] text-muted">
                <AlertTriangle size={13} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                {tw("notLiveYet")}
              </p>
            </div>
          </div>

          {/* The page as a guest first meets it — the top of it, at phone
              width, because that is what a link opens on. The rest is one
              press away rather than a column of scroll in a rail. */}
          <div className="card-surface overflow-hidden">
            <div className="flex items-center justify-between gap-tight border-b border-hairline px-card py-comfortable">
              <p className="text-[12px] font-medium text-muted">{t("customise.preview")}</p>
              <button
                type="button"
                onClick={() => setBigPreview(true)}
                className="flex min-h-9 items-center gap-inline rounded-sm px-tight text-[13px] font-medium text-muted hover:bg-subtle hover:text-fg"
              >
                <Maximize2 size={14} strokeWidth={1.5} aria-hidden />
                {tb("fullPreview")}
              </button>
            </div>
            <div className="relative flex justify-center bg-subtle p-card">
              <div className={cn("relative h-[26rem] w-[300px] overflow-hidden rounded-md shadow-md", templateFontVars)}>
                <PreviewFrame width={390}>
                  <EventTemplate event={draft} device="mobile" labels={labels} now={now} />
                </PreviewFrame>
                {/* The cut edge says "there is more", rather than pretending
                    the page ends here. */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-subtle to-transparent" />
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function StepHead({ title, help }: { title: string; help: string }) {
  return (
    <div className="mb-section">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <p className="mt-inline text-[13px] text-muted">{help}</p>
    </div>
  );
}



/** Placeholder bill so the preview is never an empty page mid-wizard.
 *  Names come from i18n per category, so the sample reads like the thing being
 *  made rather than like "Artist 1". */
const SAMPLE_LINEUP = [
  { role: undefined as string | undefined, at: "21:30" },
  { role: undefined as string | undefined, at: "20:15" },
  { role: undefined as string | undefined, at: "19:30" },
];

function EventChecklist({
  checks,
  reachable,
  onGo,
  ready,
}: {
  checks: { key: string; done: boolean; step: StepKey; hint?: string }[];
  reachable: (step: StepKey) => boolean;
  onGo: (step: StepKey) => void;
  ready: boolean;
}) {
  const tw = useTranslations("catalog.eventWizard");
  const tb = useTranslations("catalog.wizard");
  return (
    <div>
      {/* The count is the decision-relevant line, so it leads. It used to sit
          under the list in 13px grey beneath a 12px eyebrow that said nothing
          the list did not. */}
      <p className={cn("mb-tight text-[17px] font-semibold tracking-[-0.3px]", ready ? "text-success" : "text-fg")}>
        {ready ? tb("readyYes") : tb("readyNo", { count: checks.filter((c) => !c.done).length })}
      </p>
      <ul className="flex flex-col gap-0.5">
        {checks.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              disabled={!reachable(c.step)}
              onClick={() => onGo(c.step)}
              className="flex min-h-11 w-full items-start gap-tight rounded-xs px-inline py-tight text-left text-[13px] transition-colors duration-quick enabled:hover:bg-muted-wash md:min-h-9"
            >
              {c.done ? (
                <Check size={16} strokeWidth={2} aria-hidden className="mt-px shrink-0 text-success" />
              ) : (
                <Circle size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-muted" />
              )}
              <span className="flex min-w-0 flex-col">
                <span className={cn(!c.done && "text-muted")}>{tw(`check.${c.key}`)}</span>
                {c.hint && <span className="text-[12px] text-warning">{c.hint}</span>}
              </span>
              <span className="sr-only">{c.done ? tb("checkDone") : tb("checkTodo")}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

