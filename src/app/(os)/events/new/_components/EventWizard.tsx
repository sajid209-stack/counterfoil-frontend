"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createEvent, slugify, type EventCustomisation, type EventRecord } from "@/lib/api";
import { CATEGORIES, categoryById, type CategoryId } from "@/lib/events/catalog";
import { templateFontVars } from "@/lib/events/fonts";
import { EventTemplate } from "@/components/events/EventTemplate";
import { PreviewFrame } from "@/components/events/PreviewFrame";
import { DEMO_TODAY, demoNow } from "@/lib/schedule";
import { emptyTier, TicketTiers, toTiers, type FormTier } from "./TicketTiers";
import { EventArchitect, type EventContent } from "./EventArchitect";
import { useTemplateLabels } from "@/lib/events/useTemplateLabels";

const STEP_KEYS = ["category", "type", "design", "tickets", "publish"] as const;

/**
 * Create an event.
 *
 * The research bar is Luma's — a good-looking page from minimal input, in about
 * two minutes — and the warning is Eventbrite's, which reviewers call
 * "functional but clunky". Both point the same way: six steps are only
 * acceptable if five of them are nearly free.
 *
 * So every step arrives pre-answered. Picking a category picks its theme, its
 * accent, its typefaces, its section order and its layout variant; picking a
 * subtype fills the title placeholder; the tickets step opens with one General
 * admission row rather than an empty table. Nothing here asks a question it can
 * answer itself, and the preview appears from step three so the operator is
 * looking at the thing they are making rather than at a form about it.
 */
export function EventWizard() {
  const t = useTranslations("events");
  const router = useRouter();
  const toast = useToast();
  const now = useMemo(() => demoNow(), []);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [categoryId, setCategoryId] = useState<CategoryId | null>(null);
  const [subtype, setSubtype] = useState("");
  const [custom, setCustom] = useState<EventCustomisation | null>(null);

  const [content, setContent] = useState<EventContent>({
    title: "",
    subtitle: "",
    date: DEMO_TODAY,
    startTime: "19:00",
    venueName: "",
    venueAddress: "",
    description: "",
    coverUrl: "",
    lineup: [],
    faq: [],
  });
  const patchContent = (patch: Partial<EventContent>) => setContent((c) => ({ ...c, ...patch }));
  /* Overrides for the content a CATEGORY seeds — stats, highlights, the info
     trio. Held apart from `content` and cleared when the category changes, so
     switching from a gallery to a rave does not carry "Open Tue–Sun" across. */
  const [seedEdits, setSeedEdits] = useState<Partial<EventRecord>>({});
  const patchDraft = (patch: Partial<EventRecord>) => setSeedEdits((e) => ({ ...e, ...patch }));
  const [tiers, setTiers] = useState<FormTier[]>([emptyTier()]);

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
    setStep(1);
  };

  const labels = useTemplateLabels(categoryId);

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
      startsAt: `${content.date}T${content.startTime}:00+06:00`,
      venueName: content.venueName.trim() || t("placeholder.venue"),
      venueAddress: content.venueAddress.trim() || undefined,
      description: content.description.trim() || t("placeholder.description"),
      // The operator's own bill once there is one; a sample stands in only
      // while the section is still empty, so the preview is never a blank page.
      /* The at-a-glance content a category ships with. It is real, specific
         and translated — a gallery states opening hours, a tour states where
         it departs from — because a template whose sample content is lorem
         teaches an operator nothing about what the section is FOR. */
      stats: [0, 1, 2].map((i) => ({
        id: `st${i}`,
        value: t(`defaults.${categoryId}.stat${i}.value`),
        label: t(`defaults.${categoryId}.stat${i}.label`),
      })),
      highlights: [0, 1, 2, 3].map((i) => ({ id: `hl${i}`, label: t(`defaults.${categoryId}.highlight${i}`) })),
      info: [0, 1, 2].map((i) => ({
        id: `in${i}`,
        label: t(`defaults.${categoryId}.info${i}.label`),
        value: t(`defaults.${categoryId}.info${i}.value`),
      })),
      ...seedEdits,
      lineup: content.lineup.filter((l) => l.name.trim())
        .length
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
  }, [categoryId, custom, content, subtype, tiers, now, t, seedEdits]);

  const canAdvance =
    step === 0 ? categoryId !== null
    : step === 1 ? subtype !== ""
    : step === 2 ? content.title.trim() !== "" && content.venueName.trim() !== ""
    : step === 3 ? tiers.every((r) => r.name.trim() !== "" && r.quantity.trim() !== "")
    : true;

  const validateDesign = () => {
    const e: Record<string, string> = {};
    if (!content.title.trim()) e.title = t("error.title");
    if (!content.venueName.trim()) e.venueName = t("error.venue");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateTickets = () => {
    const e: Record<string, string> = {};
    if (!tiers[0]?.name.trim()) e.tierName = t("error.tierName");
    if (!tiers[0]?.quantity.trim()) e.tierQuantity = t("error.tierQuantity");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 2 && !validateDesign()) return;
    if (step === 3 && !validateTickets()) return;
    setErrors({});
    setStep((s) => Math.min(STEP_KEYS.length - 1, s + 1));
  };

  const publish = async (publishNow: boolean) => {
    if (!draft || !categoryId || !custom) return;
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
      venueName: content.venueName.trim(),
      venueAddress: content.venueAddress.trim() || undefined,
      description: content.description.trim() || undefined,
      stats: draft?.stats ?? [],
      highlights: draft?.highlights ?? [],
      info: draft?.info ?? [],
      lineup: content.lineup.filter((l) => l.name.trim()),
      faq: content.faq.filter((f) => f.q.trim()),
      tiers: toTiers(tiers),
      customisation: { ...custom, coverUrl: content.coverUrl.trim() || undefined },
    });
    setSaving(false);
    if (res.ok) {
      toast.success(publishNow ? t("published", { title: res.data.title }) : t("savedDraft"));
      router.push("/events");
    } else {
      toast.error(res.error.message);
    }
  };

  return (
    <div className="flex flex-col gap-section pb-hero">
      {/* Stepper — completed steps are reachable, ones ahead are not. A wizard
          that will not let you go back to a decision you already made is the
          single most common complaint about this pattern. */}
      <ol className="flex flex-wrap gap-inline">
        {STEP_KEYS.map((key, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={key}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                className={cn(
                  "flex min-h-11 items-center gap-inline rounded-sm px-comfortable py-tight text-[12px] transition-colors duration-quick sm:min-h-9",
                  current ? "bg-inverse text-inverse-fg" : done ? "text-fg hover:bg-subtle" : "text-muted",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current font-mono text-[12px]">
                  {done ? <Check size={12} strokeWidth={2} /> : i + 1}
                </span>
                {t(`step.${key}`)}
              </button>
            </li>
          );
        })}
      </ol>

      {/* ── 1. Category ─────────────────────────────────────────────────── */}
      {step === 0 && (
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
                    drawn in the theme's own literal colours. A category picker
                    that shows six identical grey cards asks someone to choose a
                    look they cannot see. */}
                <span
                  className="flex h-28 items-end p-comfortable"
                  style={{ background: c.theme.bg, borderBottom: `1px solid ${c.theme.line}` }}
                >
                  <span className={templateFontVars} style={{ display: "block" }}>
                    <span
                      style={{
                        display: "block",
                        font: `700 26px/1 ${c.theme.display}`,
                        letterSpacing: c.theme.displayTracking,
                        color: c.theme.fg,
                        textTransform: c.theme.eyebrowCase === "upper" ? "uppercase" : "none",
                      }}
                    >
                      {t(`category.${c.key}`)}
                    </span>
                    <span
                      style={{
                        marginTop: 8,
                        display: "block",
                        height: 4,
                        width: 52,
                        background: c.theme.accent,
                        borderRadius: 999,
                      }}
                    />
                  </span>
                </span>
                {/* The name is NOT repeated here. It is already set at display
                    size in the swatch above, in the theme's own typeface —
                    which is both the strongest presentation of it and the
                    point of the swatch. Printing it again underneath was the
                    card saying the same word twice. */}
                <span className="block bg-card p-comfortable">
                  <span className="block text-[13px] text-muted">{t(`categoryBlurb.${c.key}`)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 2. Subtype ──────────────────────────────────────────────────── */}
      {step === 1 && categoryId && (
        <div>
          <StepHead title={t("step.typeTitle")} help={t("step.typeHelp")} />
          <div className="flex flex-wrap gap-tight">
            {categoryById(categoryId).subtypes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { setSubtype(s); setStep(2); }}
                aria-pressed={subtype === s}
                className={cn(
                  "min-h-11 rounded-sm border px-major text-sm font-medium transition-colors duration-quick",
                  subtype === s
                    ? "border-ember bg-ember/10 text-brand-foreground"
                    : "border-line text-fg hover:border-strong hover:bg-subtle",
                )}
              >
                {t(`subtype.${s}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Design — look and content, one screen ────────────────────
          Template and Details used to be two steps: choose a look, then fill a
          form and discover afterwards what it did. They are one decision, so
          they are one screen. */}
      {step === 2 && categoryId && custom && draft && (
        <div>
          <StepHead title={t("step.designTitle")} help={t("step.designHelp")} />
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
            errors={errors}
          />
        </div>
      )}

      {/* ── 4. Tickets ──────────────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <StepHead title={t("step.ticketsTitle")} help={t("step.ticketsHelp")} />
          <TicketTiers rows={tiers} onChange={setTiers} errors={errors} />
        </div>
      )}

      {/* ── 5. Publish ──────────────────────────────────────────────────── */}
      {step === 4 && draft && (
        <div>
          <StepHead title={t("step.publishTitle")} help={t("step.publishHelp")} />
          <div className="card-surface overflow-hidden">
            <div className="flex flex-wrap items-baseline justify-between gap-tight border-b border-line px-major py-comfortable">
              <h3 className="min-w-0 truncate text-base font-semibold tracking-[-0.4px]">{draft.title}</h3>
              <span className="shrink-0 font-mono text-[12px] text-muted">/e/{slugify(content.title || "event")}</span>
            </div>
            <div className="bg-subtle p-comfortable">
              <div className={cn("mx-auto overflow-hidden rounded-sm shadow-md", templateFontVars)} style={{ maxWidth: 1180 }}>
                <PreviewFrame width={1180}>
                  <EventTemplate event={draft} device="desktop" labels={labels} now={now} />
                </PreviewFrame>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-tight">
        {step > 0 && (
          <Button variant="secondary" icon={<ArrowLeft size={16} strokeWidth={1.5} />} onClick={() => setStep((s) => s - 1)}>
            {t("back")}
          </Button>
        )}
        <span className="flex-1" />
        {step === STEP_KEYS.length - 1 ? (
          <>
            <Button variant="secondary" loading={saving} onClick={() => publish(false)}>
              {t("saveDraft")}
            </Button>
            <Button loading={saving} icon={<Rocket size={16} strokeWidth={1.5} />} onClick={() => publish(true)}>
              {t("publish")}
            </Button>
          </>
        ) : (
          <Button disabled={!canAdvance} icon={<ArrowRight size={16} strokeWidth={1.5} />} onClick={next}>
            {t("continue")}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepHead({ title, help }: { title: string; help: string }) {
  return (
    <div className="mb-section">
      <h2 className="text-base font-semibold tracking-[-0.4px]">{title}</h2>
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
