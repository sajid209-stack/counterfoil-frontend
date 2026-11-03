"use client";

import { useTranslations } from "next-intl";
import { FormField } from "@/components/ui";
import { cn } from "@/lib/cn";
import { parseEventVideo } from "@/lib/events/video";
import { listLocations } from "@/lib/api/locations";
import { useApiQuery } from "@/lib/useApi";
import type { EventDay } from "@/lib/api/events";
import type { PageSectionId, Product, ProductPage } from "@/lib/api/types";
import { CountdownSettings } from "./CountdownSettings";
import { AddButton, ItemGroup, LinkField, LinkRows, Note, PortraitField, ReadOnly } from "./editorParts";
import { newId } from "./pageOps";
import { ProgrammeBody } from "./ProgrammeEditor";

/** What every section editor needs. `onChange` already knows which row it is. */
export interface EditorCtx {
  product: Product;
  page: ProductPage;
  onChange: (patch: Partial<ProductPage>) => void;
  /** The whole page, for an editor that changes more than one field: the
   *  Countdown also adds or removes its own section. */
  onPage: (next: ProductPage) => void;
  /** When given, the About words are edited here instead of only in Details. */
  onDescription?: (next: string) => void;
  onEditDetails?: () => void;
  onEditTickets?: () => void;
  /** Writes the event's days (a day's name and hours). Without it the
   *  Programme edits sessions only. */
  onDays?: (days: EventDay[]) => void;
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

/** The words inside one open section. One column, one gap. */
export function SectionBody({ id, ctx }: { id: PageSectionId; ctx: EditorCtx }) {
  return (
    <div className="flex flex-col gap-comfortable">
      <Editor id={id} ctx={ctx} />
    </div>
  );
}

function Editor({ id, ctx }: { id: PageSectionId; ctx: EditorCtx }) {
  const t = useTranslations("catalog.page");
  const { product, page, onChange } = ctx;

  switch (id) {
    case "hero":
      return (
        <>
          <FormField
            label={t("tagline")}
            placeholder={t("taglinePlaceholder")}
            value={page.tagline ?? ""}
            onChange={(e) => onChange({ tagline: e.target.value })}
          />
          <ReadOnly action={t("editDetails")} onAction={ctx.onEditDetails}>{t("heroNote")}</ReadOnly>
        </>
      );

    case "countdown":
      return <CountdownSettings product={product} page={page} onPage={ctx.onPage} />;

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
            <FormField label={t("aboutLabel")} variant="textarea" rows={5} value={product.description} onChange={(e) => ctx.onDescription?.(e.target.value)} />
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
            onChange={(e) => onChange({ organiser: { ...page.organiser, name: page.organiser?.name ?? "", blurb: e.target.value } })}
          />
          <LinkRows
            links={page.organiser?.links}
            onChange={(links) => onChange({ organiser: { ...page.organiser, name: page.organiser?.name ?? "", links } })}
          />
        </>
      );

    case "highlights":
      return (
        <>
          <Note>{t("highlightsNote")}</Note>
          {page.highlights.map((h, i) => (
            <ItemGroup
              key={h.id}
              title={h.label.trim() || t("highlightN", { n: i + 1 })}
              removeLabel={t("removeHighlight", { name: h.label.trim() || t("highlightN", { n: i + 1 }) })}
              onRemove={() => onChange({ highlights: page.highlights.filter((x) => x.id !== h.id) })}
            >
              <FormField label={t("highlightLabel")} value={h.label} onChange={(e) => onChange({ highlights: page.highlights.map((x) => (x.id === h.id ? { ...x, label: e.target.value } : x)) })} />
              <FormField label={t("highlightLine")} value={h.description ?? ""} onChange={(e) => onChange({ highlights: page.highlights.map((x) => (x.id === h.id ? { ...x, description: e.target.value } : x)) })} />
            </ItemGroup>
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

    case "video": {
      const url = page.videoUrl ?? "";
      const ok = !!parseEventVideo(url);
      return (
        <>
          <FormField label={t("videoLabel")} placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => onChange({ videoUrl: e.target.value })} />
          {url.trim() !== "" && <p className={cn("text-sm", ok ? "text-muted" : "text-danger")}>{ok ? t("videoOk") : t("videoBad")}</p>}
        </>
      );
    }

    case "faq":
      return (
        <>
          {page.faq.map((f, i) => (
            <ItemGroup
              key={f.id}
              title={f.q.trim() || t("faqN", { n: i + 1 })}
              removeLabel={t("removeFaq", { name: f.q.trim() || t("faqN", { n: i + 1 }) })}
              onRemove={() => onChange({ faq: page.faq.filter((x) => x.id !== f.id) })}
            >
              <FormField label={t("faqQ")} value={f.q} placeholder={t("faqQPlaceholder")} onChange={(e) => onChange({ faq: page.faq.map((x) => (x.id === f.id ? { ...x, q: e.target.value } : x)) })} />
              <FormField label={t("faqA")} variant="textarea" rows={2} value={f.a} onChange={(e) => onChange({ faq: page.faq.map((x) => (x.id === f.id ? { ...x, a: e.target.value } : x)) })} />
            </ItemGroup>
          ))}
          <AddButton onClick={() => onChange({ faq: [...page.faq, { id: newId("f"), q: "", a: "" }] })}>{t("addFaq")}</AddButton>
        </>
      );

    case "sponsors":
      return (
        <>
          {page.sponsors.map((s, i) => (
            <ItemGroup
              key={s.id}
              title={s.name.trim() || t("sponsorN", { n: i + 1 })}
              removeLabel={t("removeSponsor", { name: s.name.trim() || t("sponsorN", { n: i + 1 }) })}
              onRemove={() => onChange({ sponsors: page.sponsors.filter((x) => x.id !== s.id) })}
            >
              <FormField label={t("sponsorName")} value={s.name} onChange={(e) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) })} />
              <FormField label={t("sponsorLevel")} placeholder={t("sponsorLevelPlaceholder")} value={s.tier ?? ""} onChange={(e) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, tier: e.target.value } : x)) })} />
              <PortraitField
                shape="logo"
                name={s.name.trim() || t("sponsorN", { n: i + 1 })}
                url={s.logoUrl}
                onChange={(logoUrl) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, logoUrl } : x)) })}
              />
              <LinkField
                label={t("sponsorLink")}
                placeholder={t("sponsorLinkPlaceholder")}
                value={s.href ?? ""}
                onChange={(href) => onChange({ sponsors: page.sponsors.map((x) => (x.id === s.id ? { ...x, href } : x)) })}
              />
            </ItemGroup>
          ))}
          <AddButton onClick={() => onChange({ sponsors: [...page.sponsors, { id: newId("sp"), name: "", tier: "" }] })}>{t("addSponsor")}</AddButton>
        </>
      );

    case "lineup":
    case "schedule":
      return <ProgrammeBody ctx={ctx} />;

    case "host": {
      const host = page.blocks?.host ?? { name: "" };
      const patchHost = (p: Partial<NonNullable<NonNullable<ProductPage["blocks"]>["host"]>>) => onChange({ blocks: { ...page.blocks, host: { ...host, ...p } } });
      return (
        <>
          <FormField label={t("hostName")} value={host.name} onChange={(e) => patchHost({ name: e.target.value })} />
          <FormField label={t("hostRole")} placeholder={t("hostRolePlaceholder")} value={host.role ?? ""} onChange={(e) => patchHost({ role: e.target.value })} />
          <FormField label={t("hostBio")} variant="textarea" rows={3} value={host.bio ?? ""} onChange={(e) => patchHost({ bio: e.target.value })} />
          <PortraitField name={host.name.trim() || t("hostN")} url={host.photoUrl} onChange={(photoUrl) => patchHost({ photoUrl })} />
          <LinkRows links={host.links} onChange={(links) => patchHost({ links })} />
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
        <ItemGroup
          key={f.id}
          title={f.label.trim() || t("infoN", { n: i + 1 })}
          removeLabel={t("removeInfo", { name: f.label.trim() || t("infoN", { n: i + 1 }) })}
          onRemove={() => onChange({ info: page.info.filter((x) => x.id !== f.id) })}
        >
          <FormField label={t("infoLabel")} placeholder={t("infoLabelPlaceholder")} value={f.label} onChange={(e) => onChange({ info: page.info.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
          <FormField label={t("infoValue")} value={f.value} onChange={(e) => onChange({ info: page.info.map((x) => (x.id === f.id ? { ...x, value: e.target.value } : x)) })} />
        </ItemGroup>
      ))}
      <AddButton onClick={() => onChange({ info: [...page.info, { id: newId("i"), label: "", value: "" }] })}>{t("addInfo")}</AddButton>
    </>
  );
}
