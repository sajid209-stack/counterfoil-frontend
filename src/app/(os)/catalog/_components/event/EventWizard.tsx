"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, Circle, Pencil } from "lucide-react";
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
import { EventArchitect, type EventContent } from "./EventArchitect";
import { EventDetails } from "./EventDetails";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";
import { WhereSold } from "../WhereSold";
import type { SectionId } from "@/lib/events/catalog";

type StepKey = "category" | "details" | "design" | "tickets" | "publish";

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
  const steps: StepKey[] = initialCategory ? ["details", "design", "tickets", "publish"] : ["category", "details", "design", "tickets", "publish"];
  const [stepKey, setStepKey] = useState<StepKey>(steps[0]);
  const stepIndex = Math.max(0, steps.indexOf(stepKey));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /* The one checklist rule, as in the booking wizard: nothing is ticked on
     the operator's behalf — an item is done once its step has been seen and
     what it holds is valid. */
  const [seen, setSeen] = useState<Set<StepKey>>(() => new Set([steps[0]]));
  const [checklistOpen, setChecklistOpen] = useState(false);
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
    date: "",
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

  const goTo = (key: StepKey) => {
    setSeen((cur) => (cur.has(key) ? cur : new Set(cur).add(key)));
    setStepError(null);
    setStepKey(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    goTo("details");
  };

  const labels = useTemplateLabels(categoryId);
  /* The preview needs a date before the operator has chosen one; a fortnight
     out reads as an event and the countdown has something to count. */
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
    { key: "name", done: seen.has("details") && !!content.title.trim(), step: "details" },
    { key: "date", done: seen.has("details") && !!content.date, step: "details" },
    { key: "venue", done: seen.has("details") && !!content.venueName.trim(), step: "details" },
    {
      key: "page",
      done: seen.has("design") && samples.length === 0,
      step: "design",
      hint: seen.has("design") && samples.length > 0 ? tw("hint.samples", { count: samples.length }) : undefined,
    },
    {
      key: "tickets",
      done: seen.has("tickets") && ticketsValid,
      step: "tickets",
      hint: seen.has("tickets") && unpriced ? tb("hint.needsPrice", { name: unpriced.name.trim() }) : undefined,
    },
    {
      key: "channel",
      done: seen.has("tickets") && channelDone,
      step: "tickets",
      hint: seen.has("tickets") && !channelDone ? (counter || online ? tb("hint.needsLocation") : tb("nowhere")) : undefined,
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

  const next = () => {
    if (stepKey === "category" && !categoryId) return;
    if (!validate(stepKey)) return;
    setErrors({});
    goTo(steps[Math.min(steps.length - 1, stepIndex + 1)]);
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
      if (need.step === "design" && seen.has("design")) setStepError(tw("hint.samples", { count: samples.length }));
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
  const wide = stepKey === "design" || stepKey === "category";

  return (
    <div className={cn("grid gap-major pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-hero", !wide && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
      <Modal open={checklistOpen} onClose={() => setChecklistOpen(false)} title={tb("readyTitle")}>
        <EventChecklist checks={checks} reachable={(step) => seen.has(step)} onGo={(step) => { setChecklistOpen(false); goTo(step); }} ready={ready} />
      </Modal>
      <div className="flex min-w-0 flex-col gap-section">
        {/* What this is, and the one way back to choosing something else. */}
        {categoryId && (
          <div className="flex flex-wrap items-center gap-tight text-[13px]">
            <span className="text-muted">{tb("adding")}</span>
            <span className="rounded-full border border-line bg-card px-comfortable py-0.5 font-medium text-fg">{catName}</span>
            <Link href="/catalog/new?kind=events" className="inline-flex min-h-11 items-center font-medium text-brand-foreground underline-offset-2 hover:underline md:min-h-0">{tb("changeKind")}</Link>
          </div>
        )}

        <div className="flex flex-col gap-inline sm:hidden">
          <p className="text-[13px] text-muted">
            {tb("stepOf", { n: stepIndex + 1, total: steps.length })} · <span className="font-medium text-fg">{tw(`step.${stepKey}`)}</span>
          </p>
          <span className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-ember-solid transition-[width] duration-quick" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
          </span>
        </div>

        {/* Stepper — completed steps are reachable, ones ahead are not. */}
        <ol className="hidden flex-wrap gap-inline sm:flex" aria-label={tb("progress")}>
          {steps.map((key, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={i > stepIndex}
                  aria-current={current ? "step" : undefined}
                  onClick={() => goTo(key)}
                  className={cn(
                    "flex min-h-9 items-center gap-inline rounded-sm px-comfortable py-tight text-[12px] transition-colors duration-quick",
                    current ? "bg-inverse text-inverse-fg" : done ? "text-fg hover:bg-subtle" : "text-muted",
                  )}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px] tabular-nums">
                    {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                  </span>
                  {tw(`step.${key}`)}
                </button>
              </li>
            );
          })}
        </ol>

        {stepError && (
          <p role="alert" tabIndex={-1} data-step-error className="flex items-start gap-tight rounded-sm border border-danger/40 bg-danger-wash px-comfortable py-tight text-[13px] font-medium text-danger outline-none">
            <AlertTriangle size={15} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0" />
            {stepError}
          </p>
        )}

        {/* ── Category (only when the chooser did not already pick one) ──── */}
        {stepKey === "category" && (
          <div>
            <StepHead title={t("step.categoryTitle")} help={t("step.categoryHelp")} />
            <div className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickCategory(c.id)}
                  aria-pressed={categoryId === c.id}
                  className={cn(
                    "group overflow-hidden rounded-md border text-left transition-all duration-quick hover:-translate-y-0.5 hover:shadow-md",
                    categoryId === c.id ? "border-ember ring-2 ring-ember/20" : "border-line hover:border-strong",
                  )}
                >
                  {/* The swatch IS the theme — ground, accent and display face,
                      drawn in the theme's own literal colours. */}
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

        {/* ── Details — the facts, before anything is designed ─────────── */}
        {stepKey === "details" && categoryId && (
          <div className="card-surface p-card">
            <StepHead title={tw("title.details")} help={tw("help.details")} />
            <EventDetails categoryId={categoryId} content={content} onContent={patchContent} errors={errors} subtype={subtype} onSubtype={setSubtype} />
          </div>
        )}

        {/* ── Page — look and content, one screen ─────────────────────────── */}
        {stepKey === "design" && categoryId && custom && draft && (
          <div>
            <StepHead title={t("step.designTitle")} help={tw("help.design")} />
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
              onEditDetails={() => goTo("details")}
              samples={samples}
            />
          </div>
        )}

        {/* ── Tickets ─────────────────────────────────────────────────────── */}
        {stepKey === "tickets" && (
          <div className="card-surface p-card">
            <StepHead title={tw("title.tickets")} help={t("step.ticketsHelp")} />
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
          </div>
        )}

        {/* ── Put on sale — everything, one row a step, then the page ───── */}
        {stepKey === "publish" && draft && (
          <div className="flex flex-col gap-section">
            <div className="card-surface p-card">
              <StepHead title={tw("title.publish")} help={tw("help.publish")} />
              <Review label={tw("row.details")} onEdit={() => goTo("details")} editText={tb("edit")} editLabel={tb("editStep", { step: tw("step.details") })}>
                <span className="block font-medium">{content.title.trim() || <Missing>{tw("check.name")}</Missing>}</span>
                <span className="block text-muted">{whenText ?? <Missing>{tw("check.date")}</Missing>}</span>
                <span className="block text-muted">
                  {content.venueName.trim() ? [content.venueName.trim(), content.venueAddress.trim()].filter(Boolean).join(" · ") : <Missing>{tw("check.venue")}</Missing>}
                </span>
              </Review>
              <Review label={tw("row.page")} onEdit={() => goTo("design")} editText={tb("edit")} editLabel={tb("editStep", { step: tw("step.design") })}>
                <span className="flex items-center gap-tight">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-fg/25" style={{ background: custom?.accent }} />
                  {[catName, t(`variant.${custom?.variant}`), tw("sections", { count: custom?.sections.length ?? 0 })].join(" · ")}
                </span>
                <span className="block font-mono text-[12px] text-muted">/e/{slugify(content.title || "event")}</span>
              </Review>
              <Review label={tw("row.tickets")} onEdit={() => goTo("tickets")} editText={tb("edit")} editLabel={tb("editStep", { step: tw("step.tickets") })}>
                {liveTiers.length ? (
                  <span className="flex flex-col gap-0.5">
                    {liveTiers.map((x) => (
                      <span key={x.id} className="flex items-baseline justify-between gap-section">
                        <span>
                          {x.name}
                          <span className="text-muted"> · {tw("qty", { count: x.quantity })}</span>
                        </span>
                        <span className="tabular-nums">{x.price === 0 ? t("free") : formatPriceShort(x.price)}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  <Missing>{tw("check.tickets")}</Missing>
                )}
              </Review>
              <Review label={tw("row.where")} onEdit={() => goTo("tickets")} editText={tb("edit")} editLabel={tb("editStep", { step: tw("step.tickets") })}>
                <span className="flex flex-col gap-0.5">
                  <ChannelLine on={online} label={tw("onlinePage")} />
                  <ChannelLine on={counter} label={tb("atCounter")} />
                  {!online && <span className="text-[13px] text-warning">{tb("notOnlineShort")}</span>}
                  {counter && (locationIds.length > 0 ? (
                    <span className="text-muted">{locations.filter((l) => locationIds.includes(l.id)).map((l) => l.name).join(" · ")}</span>
                  ) : (
                    <Missing>{tb("hint.needsLocation")}</Missing>
                  ))}
                </span>
              </Review>
              <p className={cn("mt-section rounded-sm px-comfortable py-tight text-[13px]", ready ? "bg-success-wash text-fg" : "bg-muted-wash text-muted")}>
                {ready ? tw("ready") : tw("notReady")}
              </p>
              {/* Honest about the one thing the screen cannot promise yet. */}
              <p className="mt-tight flex items-start gap-tight text-[13px] text-muted">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                {tw("notLiveYet")}
              </p>
            </div>
            <div className="card-surface overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-tight border-b border-line px-card py-comfortable">
                <h3 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{t("customise.preview")}</h3>
              </div>
              <div className="bg-subtle p-card">
                <div className={cn("mx-auto overflow-hidden rounded-sm shadow-md", templateFontVars)} style={{ maxWidth: 1180 }}>
                  <PreviewFrame width={1180}>
                    <EventTemplate event={draft} device="desktop" labels={labels} now={now} />
                  </PreviewFrame>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer — pinned to the bottom on a phone ────────────────────── */}
        {stepKey !== "category" && (
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-tight border-t border-line bg-surface/95 px-gutter pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-tight backdrop-blur-xl md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <button
              type="button"
              onClick={() => setChecklistOpen(true)}
              className={cn("flex min-h-11 items-center gap-inline text-[13px] font-medium lg:hidden", ready ? "text-success" : "text-muted")}
            >
              {ready ? <Check size={15} strokeWidth={2} aria-hidden /> : null}
              {ready ? tb("readyShort") : tb("leftShort", { count: checks.filter((c) => !c.done).length })}
              <ChevronRight size={14} strokeWidth={1.5} aria-hidden />
            </button>
            {stepIndex > 0 && (
              <Button variant="secondary" icon={<ArrowLeft size={16} strokeWidth={1.5} />} onClick={() => goTo(steps[stepIndex - 1])}>
                {t("back")}
              </Button>
            )}
            <span className="flex-1" />
            {stepKey === "publish" ? (
              <>
                <Button variant="secondary" loading={saving} onClick={() => publish(false)}>
                  {tb("saveOffSale")}
                </Button>
                <Button loading={saving} onClick={() => publish(true)}>
                  {tb("putOnSale")}
                </Button>
              </>
            ) : (
              <Button onClick={next}>
                {t("continue")}
                <ArrowRight size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* The event as it stands, and what stands between it and the box
          office — beside every step but the page designer, whose preview is
          already the summary. */}
      {!wide && categoryId && (
        <aside className="hidden h-fit lg:sticky lg:top-section lg:block" aria-label={tw("summaryTitle")}>
          <div className="card-surface overflow-hidden">
            <div className="border-b border-hairline p-card">
              <p className="type-label text-[12px] text-muted">{tw("summaryTitle")}</p>
              <p className={cn("mt-inline break-words text-[16px] font-semibold leading-snug", !content.title.trim() && "text-muted")}>{content.title.trim() || tw("untitled")}</p>
              <p className="mt-0.5 text-[12px] text-muted">{[catName, subtype ? t(`subtype.${subtype}`) : null].filter(Boolean).join(" · ")}</p>
              {whenText && <p className="mt-tight text-[13px]">{whenText}</p>}
              {content.venueName.trim() && <p className="text-[13px] text-muted">{content.venueName.trim()}</p>}
              {capacity > 0 && fromPrice !== null && (
                <p className="mt-tight text-[13px] tabular-nums">
                  {tw("fromAndCap", { price: fromPrice === 0 ? t("free") : formatPriceShort(fromPrice ?? 0), count: capacity.toLocaleString() })}
                </p>
              )}
            </div>
            <div className="p-card">
              <EventChecklist checks={checks} reachable={(step) => seen.has(step)} onGo={goTo} ready={ready} />
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

function Review({ label, onEdit, editText, editLabel, children }: { label: string; onEdit: () => void; editText: string; editLabel: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-section gap-y-inline border-t border-hairline py-comfortable text-[14px] sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
      <span className="col-span-2 text-[13px] font-medium text-muted sm:col-span-1">{label}</span>
      <span className="min-w-0">{children}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={editLabel}
        className="-my-tight flex h-11 items-center gap-inline self-start rounded-sm px-tight text-[13px] font-medium text-brand-foreground hover:bg-muted-wash sm:h-9"
      >
        <Pencil size={13} strokeWidth={1.5} aria-hidden />
        <span className="max-sm:sr-only">{editText}</span>
      </button>
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-inline text-warning">
      <AlertTriangle size={13} strokeWidth={2} aria-hidden />
      {children}
    </span>
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
      <p className="type-label mb-tight text-[12px] text-muted">{tb("readyTitle")}</p>
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
      <p className={cn("mt-tight text-[13px] font-medium", ready ? "text-success" : "text-muted")}>
        {ready ? tb("readyYes") : tb("readyNo", { count: checks.filter((c) => !c.done).length })}
      </p>
    </div>
  );
}

function ChannelLine({ on, label }: { on: boolean; label: string }) {
  const tb = useTranslations("catalog.wizard");
  return (
    <span className={cn("inline-flex items-center gap-inline", !on && "text-muted")}>
      {on ? <Check size={14} strokeWidth={2} aria-hidden className="text-success" /> : <Circle size={14} strokeWidth={1.5} aria-hidden />}
      {on ? label : tb("channelOff", { name: label })}
    </span>
  );
}
