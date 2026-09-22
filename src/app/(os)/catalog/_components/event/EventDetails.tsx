"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { DateField, FormField, TimeInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { categoryById, type CategoryId } from "@/lib/events/catalog";
import { DEMO_TODAY } from "@/lib/schedule";
import type { EventContent } from "./EventArchitect";

/**
 * An event's facts: what it is called, when it is, where it is, and its cover.
 *
 * These used to live inside the page designer's Hero and Venue rows, so moving
 * a match by a week — the commonest edit a box office makes — meant opening a
 * design tool and finding the date among the colour pickers. They are the
 * record, not the look of it: the page reads them, but they are set here,
 * first, before anything is designed.
 */
export function EventDetails({
  categoryId,
  content,
  onContent,
  errors,
  subtype,
  onSubtype,
}: {
  categoryId: CategoryId;
  content: EventContent;
  onContent: (patch: Partial<EventContent>) => void;
  errors: Record<string, string>;
  /** The kind of event within its category — a label only, so optional. */
  subtype?: string;
  onSubtype?: (s: string) => void;
}) {
  const t = useTranslations("events");
  const td = useTranslations("catalog.eventDetails");
  const tc = useTranslations("common");
  const cat = categoryById(categoryId);
  const dateLabels = { previousMonth: tc("previousMonth"), nextMonth: tc("nextMonth"), today: tc("today"), open: tc("openCalendar") };
  const ends = content.endTime !== "";

  return (
    <div className="flex flex-col gap-major">
      <Group title={td("what")}>
        <FormField
          label={t("field.title")}
          name="ev-title"
          required
          placeholder={td("eg", { example: td(`example.${cat.key}`) })}
          value={content.title}
          error={errors.title}
          onChange={(e) => onContent({ title: e.target.value })}
          className="sm:col-span-2"
        />
        <FormField
          label={t("field.subtitle")}
          placeholder={td("eg", { example: td("subtitleExample") })}
          help={td("subtitleHelp")}
          value={content.subtitle}
          onChange={(e) => onContent({ subtitle: e.target.value })}
          className="sm:col-span-2"
        />
        {onSubtype && (
          <FormField
            label={td("kind")}
            variant="select"
            help={td("kindHelp")}
            value={subtype ?? ""}
            onChange={(e) => onSubtype(e.target.value)}
            options={[{ value: "", label: td("kindNone") }, ...cat.subtypes.map((s) => ({ value: s, label: t(`subtype.${s}`) }))]}
          />
        )}
      </Group>

      <Group title={td("when")}>
        <Labelled label={td("date")} required error={errors.date}>
          <DateField size="form" value={content.date || null} today={DEMO_TODAY} min={DEMO_TODAY} onChange={(v) => onContent({ date: v, endDate: content.endDate && content.endDate >= v ? content.endDate : v })} labels={dateLabels} placeholder={td("pickDate")} />
        </Labelled>
        <TimeInput label={td("starts")} value={content.startTime} onChange={(v) => onContent({ startTime: v })} />
        {ends ? (
          <>
            <Labelled label={td("endDate")}>
              <DateField size="form" value={content.endDate || content.date || null} today={DEMO_TODAY} min={content.date || DEMO_TODAY} onChange={(v) => onContent({ endDate: v })} labels={dateLabels} />
            </Labelled>
            <div className="flex flex-col gap-inline">
              <TimeInput label={td("ends")} value={content.endTime} onChange={(v) => onContent({ endTime: v })} />
              <button type="button" onClick={() => onContent({ endTime: "", endDate: "" })} className="flex min-h-11 items-center gap-inline self-start rounded-sm px-tight text-[13px] font-medium text-muted hover:bg-muted-wash hover:text-fg md:min-h-9">
                <X size={14} strokeWidth={1.5} aria-hidden /> {td("removeEnd")}
              </button>
            </div>
            {errors.ends && <p role="alert" className="text-[13px] text-danger sm:col-span-2">{errors.ends}</p>}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onContent({ endTime: "23:00", endDate: content.date })}
            className="flex min-h-11 items-center self-start text-[13px] font-medium text-brand-foreground hover:underline sm:col-span-2 md:min-h-0"
          >
            + {td("addEnd")}
          </button>
        )}
      </Group>

      <Group title={td("where")}>
        <FormField
          label={t("field.venue")}
          name="ev-venue"
          required
          placeholder={td("eg", { example: t("field.venuePlaceholder") })}
          value={content.venueName}
          error={errors.venueName}
          onChange={(e) => onContent({ venueName: e.target.value })}
        />
        <FormField
          label={t("field.address")}
          placeholder={td("eg", { example: t("field.addressPlaceholder") })}
          value={content.venueAddress}
          onChange={(e) => onContent({ venueAddress: e.target.value })}
        />
      </Group>

      <Group title={td("cover")} help={td("coverHelp")}>
        <CoverUpload value={content.coverUrl} onChange={(url) => onContent({ coverUrl: url })} className="sm:col-span-2" />
      </Group>
    </div>
  );
}

function Group({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-section">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {help && <p className="mt-0.5 text-[13px] text-muted">{help}</p>}
      </div>
      <div className="grid items-start gap-section sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Labelled({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-tight" data-invalid={error ? "" : undefined}>
      <span className="type-label text-[12px] text-muted">
        {label}
        {required && <span className="ml-inline text-danger">*</span>}
      </span>
      {children}
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}

/** A cover is chosen from the computer or phone, like any photo — never typed
 *  in as a link. Mock storage: an in-session object URL, as the booking
 *  images use, until real storage sits behind `lib/api`. */
function CoverUpload({ value, onChange, className }: { value: string; onChange: (url: string) => void; className?: string }) {
  const td = useTranslations("catalog.eventDetails");
  const input = useRef<HTMLInputElement>(null);
  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onChange(URL.createObjectURL(f));
  };
  return (
    <div className={cn("flex flex-col gap-tight", className)}>
      {value ? (
        <div className="flex flex-col gap-tight sm:flex-row sm:items-end">
          <span
            role="img"
            aria-label={td("coverPreview")}
            className="block aspect-[16/9] w-full max-w-sm rounded-sm border border-line bg-subtle bg-cover bg-center"
            style={{ backgroundImage: `url("${value}")` }}
          />
          <span className="flex gap-tight">
            <button type="button" onClick={() => input.current?.click()} className="flex min-h-11 items-center gap-inline rounded-sm border border-line bg-card px-comfortable text-[13px] font-medium hover:border-strong md:min-h-9">
              <RefreshCw size={14} strokeWidth={1.5} aria-hidden /> {td("replace")}
            </button>
            <button type="button" onClick={() => onChange("")} className="flex min-h-11 items-center gap-inline rounded-sm border border-line bg-card px-comfortable text-[13px] font-medium text-danger hover:border-danger md:min-h-9">
              <Trash2 size={14} strokeWidth={1.5} aria-hidden /> {td("remove")}
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
          className="flex h-32 w-full max-w-md flex-col items-center justify-center gap-inline rounded-sm border border-dashed border-line bg-card text-muted transition-colors duration-quick hover:border-strong hover:text-fg"
        >
          <ImagePlus size={22} strokeWidth={1.5} aria-hidden />
          <span className="text-[13px] font-medium text-fg">{td("upload")}</span>
          <span className="text-[12px]">{td("uploadHint")}</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}
