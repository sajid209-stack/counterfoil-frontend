"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import { Button, FormField, Tabs, TimeInput } from "@/components/ui";
import { cn } from "@/lib/cn";
import { dayName } from "@/lib/events/days";
import { parseEventVideo } from "@/lib/events/video";
import { listLocations } from "@/lib/api/locations";
import { useApiQuery } from "@/lib/useApi";
import type { PageSectionId, Product, ProductPage } from "@/lib/api/types";
import { newId } from "./pageOps";

/** What every section editor needs. `onChange` already knows which row it is. */
export interface EditorCtx {
  product: Product;
  page: ProductPage;
  onChange: (patch: Partial<ProductPage>) => void;
  /** When given, the About words are edited here instead of only in Details. */
  onDescription?: (next: string) => void;
  onEditDetails?: () => void;
  onEditTickets?: () => void;
  /** Takes the operator to the countdown settings, which live above the list. */
  onGoCountdown?: () => void;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

/** A line of read-only text with the one place it is changed. */
function ReadOnly({ children, action, onAction }: { children: React.ReactNode; action: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col gap-tight">
      <div className="text-sm text-fg">{children}</div>
      {onAction && (
        <Button variant="secondary" size="sm" className="self-start" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} icon={<Plus size={15} strokeWidth={1.5} aria-hidden />} className="w-full">
      {children}
    </Button>
  );
}

/** One editable item in a list, with its remove button named for what it removes. */
function ItemCard({ title, removeLabel, onRemove, children }: { title: string; removeLabel: string; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-card p-comfortable">
      <div className="mb-tight flex items-center justify-between gap-tight">
        <span className="min-w-0 truncate text-sm font-medium text-muted">{title}</span>
        <Button variant="tertiary" size="icon" aria-label={removeLabel} title={removeLabel} onClick={onRemove} className="text-muted hover:text-danger">
          <Trash2 size={15} strokeWidth={1.5} aria-hidden />
        </Button>
      </div>
      <div className="grid gap-tight">{children}</div>
    </div>
  );
}

/** The item's rules as short lines, from what the booking already says. */
function policyLines(product: Product, t: ReturnType<typeof useTranslations>): string[] {
  const p = product.policies;
  const lines: string[] = [];
  if (p) {
    lines.push(p.cancellation === "none" ? t("policy.cancelNone") : p.cancellation === "free_until" ? t("policy.cancelFree", { hours: p.cancelHours }) : t("policy.cancelFee", { pct: p.cancelFeePct }));
    lines.push(p.reschedule === "none" ? t("policy.moveNone") : t("policy.moveUntil", { hours: p.rescheduleHours }));
    lines.push(p.reentry === "single" ? t("policy.entrySingle") : p.reentry === "same_day" ? t("policy.entryDay") : t("policy.entryValid"));
    if (p.waiver) lines.push(t("policy.waiver"));
  }
  if (product.minAge) lines.push(t("policy.age", { age: product.minAge }));
  return lines;
}

/** Where it is: the event's own venue, or the venues the booking is sold at. */
function WhereBody({ ctx }: { ctx: EditorCtx }) {
  const t = useTranslations("catalog.page");
  const { product } = ctx;
  const q = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const own = product.event?.venueName?.trim();
  const places = (q.data?.data ?? []).filter((l) => product.locationIds.includes(l.id));
  return (
    <ReadOnly action={t("editDetails")} onAction={ctx.onEditDetails}>
      {own ? (
        <>
          <span className="block font-medium">{own}</span>
          {product.event?.venueAddress && <span className="block text-muted">{product.event.venueAddress}</span>}
        </>
      ) : places.length > 0 ? (
        <ul className="flex flex-col gap-tight">
          {places.map((l) => (
            <li key={l.id}>
              <span className="font-medium">{l.name}</span>
              <span className="block text-muted">{[l.addressLine1, l.city].filter(Boolean).join(", ")}</span>
            </li>
          ))}
        </ul>
      ) : (
        t("venueNote")
      )}
    </ReadOnly>
  );
}

export function SectionBody({ id, ctx }: { id: PageSectionId; ctx: EditorCtx }) {
  const t = useTranslations("catalog.page");
  const { product, page, onChange } = ctx;
  const [openDay, setOpenDay] = useState(0);
  const days = product.event?.days ?? [];

  switch (id) {
    case "hero":
      return <ReadOnly action={t("editDetails")} onAction={ctx.onEditDetails}>{t("heroNote")}</ReadOnly>;

    case "countdown":
      return <ReadOnly action={t("goCountdown")} onAction={ctx.onGoCountdown}>{t("countdownRowNote")}</ReadOnly>;

    case "tickets":
      return <ReadOnly action={t("editTickets")} onAction={ctx.onEditTickets}>{t("ticketsNote")}</ReadOnly>;

    case "gallery":
      return (
        <ReadOnly action={t("editDetails")} onAction={ctx.onEditDetails}>
          {product.images.length > 0 ? (
            <>
              <div className="mb-tight flex flex-wrap gap-tight">
                {product.images.slice(0, 6).map((img) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={img.id} src={img.url} alt={img.alt ?? ""} className="h-12 w-12 rounded-xs bg-muted-wash object-cover" />
                ))}
              </div>
              {t("galleryCount", { count: product.images.length })}
            </>
          ) : (
            t("galleryNone")
          )}
        </ReadOnly>
      );

    case "venue":
      return <WhereBody ctx={ctx} />;

    case "included": {
      const rows = product.tiers.filter((x) => x.active);
      return (
        <ReadOnly action={t("editTickets")} onAction={ctx.onEditTickets}>
          {rows.length === 0 ? (
            t("includedNone")
          ) : (
            <ul className="flex flex-col gap-tight">
              {rows.map((x) => (
                <li key={x.id}>
                  <span className="font-medium">{x.name}</span>
                  <span className="block text-muted">
                    {[x.note?.trim(), ...(x.perks ?? [])].filter(Boolean).join(" · ") || t("includedNoNote")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ReadOnly>
      );
    }

    case "about":
      return (
        <>
          {ctx.onDescription ? (
            <FormField
              label={t("aboutLabel")}
              variant="textarea"
              rows={5}
              value={product.description}
              help={t("aboutHelp")}
              onChange={(e) => ctx.onDescription?.(e.target.value)}
            />
          ) : (
            <ReadOnly action={t("editDetails")} onAction={ctx.onEditDetails}>
              {product.description.trim() ? <span className="line-clamp-4 whitespace-pre-line">{product.description}</span> : t("aboutNone")}
            </ReadOnly>
          )}
          <FormField
            label={t("organiser")}
            placeholder={t("organiserPlaceholder")}
            value={page.organiser?.name ?? ""}
            onChange={(e) => onChange({ organiser: { ...page.organiser, name: e.target.value } })}
          />
          <FormField
            label={t("organiserLine")}
            value={page.organiser?.blurb ?? ""}
            onChange={(e) => onChange({ organiser: { name: page.organiser?.name ?? "", blurb: e.target.value } })}
          />
        </>
      );

    case "highlights":
      return (
        <>
          <Note>{t("highlightsNote")}</Note>
          {page.highlights.map((h, i) => (
            <ItemCard
              key={h.id}
              title={h.label.trim() || t("highlightN", { n: i + 1 })}
              removeLabel={t("removeHighlight", { name: h.label.trim() || t("highlightN", { n: i + 1 }) })}
              onRemove={() => onChange({ highlights: page.highlights.filter((x) => x.id !== h.id) })}
            >
              <FormField label={t("highlightLabel")} value={h.label} onChange={(e) => onChange({ highlights: page.highlights.map((x) => (x.id === h.id ? { ...x, label: e.target.value } : x)) })} />
              <FormField label={t("highlightLine")} value={h.description ?? ""} onChange={(e) => onChange({ highlights: page.highlights.map((x) => (x.id === h.id ? { ...x, description: e.target.value } : x)) })} />
            </ItemCard>
          ))}
          <AddButton onClick={() => onChange({ highlights: [...page.highlights, { id: newId("h"), label: "", description: "" }] })}>{t("addHighlight")}</AddButton>
        </>
      );

    case "know": {
      const rules = policyLines(product, t);
      return (
        <>
          <Note>{t("knowNote")}</Note>
          {rules.length > 0 && (
            <ul className="flex flex-col gap-inline text-sm text-fg">
              {rules.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <InfoRows ctx={ctx} />
        </>
      );
    }

    case "stats":
      return (
        <>
          <Note>{t("statsNote")}</Note>
          {page.stats.map((s, i) => (
            <ItemCard
              key={s.id}
              title={s.label.trim() || t("statN", { n: i + 1 })}
              removeLabel={t("removeStat", { name: s.label.trim() || t("statN", { n: i + 1 }) })}
              onRemove={() => onChange({ stats: page.stats.filter((x) => x.id !== s.id) })}
            >
              <FormField label={t("statValue")} value={s.value} onChange={(e) => onChange({ stats: page.stats.map((x) => (x.id === s.id ? { ...x, value: e.target.value } : x)) })} />
              <FormField label={t("statLabel")} value={s.label} onChange={(e) => onChange({ stats: page.stats.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)) })} />
            </ItemCard>
          ))}
          <AddButton onClick={() => onChange({ stats: [...page.stats, { id: newId("s"), value: "", label: "" }] })}>{t("addStat")}</AddButton>
        </>
      );

    case "video": {
      const url = page.videoUrl ?? "";
      const ok = !!parseEventVideo(url);
      return (
        <>
          <Note>{t("videoNote")}</Note>
          <FormField label={t("videoLabel")} placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => onChange({ videoUrl: e.target.value })} />
          {url.trim() !== "" && <p className={cn("text-sm", ok ? "text-muted" : "text-danger")}>{ok ? t("videoOk") : t("videoBad")}</p>}
        </>
      );
    }

    case "faq":
      return (
        <>
          {page.faq.map((f, i) => (
            <ItemCard
              key={f.id}
              title={f.q.trim() || t("faqN", { n: i + 1 })}
              removeLabel={t("removeFaq", { name: f.q.trim() || t("faqN", { n: i + 1 }) })}
              onRemove={() => onChange({ faq: page.faq.filter((x) => x.id !== f.id) })}
            >
              <FormField label={t("faqQ")} value={f.q} placeholder={t("faqQPlaceholder")} onChange={(e) => onChange({ faq: page.faq.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)) })} />
              <FormField label={t("faqA")} variant="textarea" rows={2} value={f.a} onChange={(e) => onChange({ faq: page.faq.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)) })} />
            </ItemCard>
          ))}
          <AddButton onClick={() => onChange({ faq: [...page.faq, { id: newId("f"), q: "", a: "" }] })}>{t("addFaq")}</AddButton>
        </>
      );

    case "sponsors":
      return (
        <>
          <Note>{t("sponsorsNote")}</Note>
          {page.sponsors.map((s, i) => (
            <ItemCard
              key={s.id}
              title={s.name.trim() || t("sponsorN", { n: i + 1 })}
              removeLabel={t("removeSponsor", { name: s.name.trim() || t("sponsorN", { n: i + 1 }) })}
              onRemove={() => onChange({ sponsors: page.sponsors.filter((x) => x.id !== s.id) })}
            >
              <FormField label={t("sponsorName")} value={s.name} onChange={(e) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} />
              <FormField label={t("sponsorLevel")} placeholder={t("sponsorLevelPlaceholder")} value={s.tier ?? ""} onChange={(e) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, tier: e.target.value } : x)) })} />
            </ItemCard>
          ))}
          <AddButton onClick={() => onChange({ sponsors: [...page.sponsors, { id: newId("sp"), name: "", tier: "" }] })}>{t("addSponsor")}</AddButton>
        </>
      );

    case "lineup":
    case "schedule": {
      const tabs = days.length > 1 ? days.map((d, i) => ({ id: d.id, label: dayName(d, i, (n) => t("dayN", { n })) })) : [];
      const active = tabs.length > 1 ? tabs[Math.min(openDay, tabs.length - 1)] : null;
      // An entry written before the event had days is shown on the first day.
      const shown = active ? page.lineup.filter((l) => (l.dayId ? l.dayId === active.id : tabs[0].id === active.id)) : page.lineup;
      const patch = (eid: string, p: Partial<ProductPage["lineup"][number]>) => onChange({ lineup: page.lineup.map((l) => (l.id === eid ? { ...l, ...p } : l)) });
      return (
        <>
          {tabs.length > 1 && (
            <Tabs
              variant="pill"
              aria-label={t("dayTabs")}
              items={tabs.map((d) => ({ value: d.id, label: d.label, count: page.lineup.filter((l) => l.dayId === d.id).length }))}
              value={active?.id ?? ""}
              onChange={(v) => setOpenDay(Math.max(0, tabs.findIndex((d) => d.id === v)))}
            />
          )}
          {shown.length === 0 && <Note>{tabs.length > 1 ? t("dayEmpty") : t("lineupEmpty")}</Note>}
          {shown.map((l, i) => (
            <ItemCard
              key={l.id}
              title={l.name.trim() || t("entryN", { n: i + 1 })}
              removeLabel={t("removeEntry", { name: l.name.trim() || t("entryN", { n: i + 1 }) })}
              onRemove={() => onChange({ lineup: page.lineup.filter((x) => x.id !== l.id) })}
            >
              <FormField label={t("entryName")} placeholder={t("entryNamePlaceholder")} value={l.name} onChange={(e) => patch(l.id, { name: e.target.value })} />
              <FormField
                label={t("entryKind")}
                variant="select"
                value={l.kind ?? "person"}
                options={[
                  { value: "person", label: t("kindPerson") },
                  { value: "session", label: t("kindSession") },
                ]}
                onChange={(e) => patch(l.id, { kind: e.target.value as "person" | "session" })}
              />
              <FormField label={t("entryRole")} placeholder={t("entryRolePlaceholder")} value={l.role ?? ""} onChange={(e) => patch(l.id, { role: e.target.value })} />
              <TimeInput picker label={t("entryTime")} value={l.at ?? ""} onChange={(v) => patch(l.id, { at: v })} />
              {(l.kind ?? "person") === "person" && (
                <PortraitField name={l.name.trim() || t("entryN", { n: i + 1 })} url={l.imageUrl} onChange={(imageUrl) => patch(l.id, { imageUrl })} />
              )}
            </ItemCard>
          ))}
          <AddButton
            onClick={() =>
              onChange({ lineup: [...page.lineup, { id: newId("l"), name: "", role: "", at: "", dayId: active?.id }] })
            }
          >
            {t("addEntry")}
          </AddButton>
        </>
      );
    }

    default:
      return null;
  }
}

/** The facts a buyer checks: a label and its value, each the operator's own words. */
export function InfoRows({ ctx }: { ctx: EditorCtx }) {
  const t = useTranslations("catalog.page");
  const { page, onChange } = ctx;
  return (
    <>
      {page.info.map((f, i) => (
        <ItemCard
          key={f.id}
          title={f.label.trim() || t("infoN", { n: i + 1 })}
          removeLabel={t("removeInfo", { name: f.label.trim() || t("infoN", { n: i + 1 }) })}
          onRemove={() => onChange({ info: page.info.filter((x) => x.id !== f.id) })}
        >
          <FormField label={t("infoLabel")} placeholder={t("infoLabelPlaceholder")} value={f.label} onChange={(e) => onChange({ info: page.info.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
          <FormField label={t("infoValue")} value={f.value} onChange={(e) => onChange({ info: page.info.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)) })} />
        </ItemCard>
      ))}
      <AddButton onClick={() => onChange({ info: [...page.info, { id: newId("i"), label: "", value: "" }] })}>{t("addInfo")}</AddButton>
    </>
  );
}

/**
 * A portrait for a person on the bill. With portraits the page draws a photo
 * grid; without, a clean list — never a placeholder face
 * (docs/product-page.md §3.5). Mock layer: the picked file is shown from a
 * local object URL, the same way the cover upload works.
 */
function PortraitField({ name, url, onChange }: { name: string; url?: string; onChange: (url: string | undefined) => void }) {
  const t = useTranslations("catalog.page");
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-comfortable">
      <span
        aria-hidden
        className="block h-14 w-12 shrink-0 rounded-inner border border-line bg-muted-wash bg-cover bg-center"
        style={url ? { backgroundImage: `url("${url}")` } : undefined}
      />
      <div className="flex flex-wrap gap-tight">
        <Button variant="secondary" size="sm" icon={<ImagePlus size={15} strokeWidth={1.5} aria-hidden />} onClick={() => file.current?.click()} aria-label={t(url ? "portraitReplaceFor" : "portraitAddFor", { name })}>
          {url ? t("portraitReplace") : t("portraitAdd")}
        </Button>
        {url && (
          <Button variant="secondary" size="sm" onClick={() => onChange(undefined)} aria-label={t("portraitRemoveFor", { name })}>
            {t("portraitRemove")}
          </Button>
        )}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onChange(URL.createObjectURL(f));
          e.target.value = "";
        }}
      />
    </div>
  );
}
