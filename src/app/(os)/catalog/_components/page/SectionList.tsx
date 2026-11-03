"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  Clock,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListChecks,
  MapPin,
  Play,
  Plus,
  Sparkles,
  Ticket,
  Users,
  Handshake,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { EventDay } from "@/lib/api/events";
import type { PageSectionId, Product, ProductPage } from "@/lib/api/types";
import { addSection, canMove, edited, isRequired, keepSample, moveBefore, moveSection, removeSection, rowHasSample, rowsOf, sectionFill } from "./pageOps";
import { SectionBody, type EditorCtx } from "./SectionEditors";

const ICON: Partial<Record<PageSectionId, LucideIcon>> = {
  hero: ImageIcon,
  countdown: Clock,
  highlights: Sparkles,
  about: FileText,
  included: ListChecks,
  know: Info,
  lineup: Users,
  schedule: CalendarClock,
  gallery: LayoutGrid,
  video: Play,
  sponsors: Handshake,
  tickets: Ticket,
  venue: MapPin,
  faq: HelpCircle,
  host: UserRound,
};

type T = ReturnType<typeof useTranslations>;

/** One short line saying what a section holds right now. It is a fact about the
 *  page, never help: "3 points", "Empty", "Sample text". */
function stateOf(id: PageSectionId, product: Product, page: ProductPage, t: T): string {
  if (rowHasSample(page, id)) return t("state.sample");
  const fill = sectionFill(id, product, page);
  if (fill === "empty") return t("state.empty");
  const n = (count: number) => ({ count });
  switch (id) {
    case "hero":
      return page.tagline?.trim() || t("state.hero");
    case "tickets":
      return t("state.tickets", n(product.tiers.filter((x) => x.active).length));
    case "countdown":
      return page.countdown?.mode === "date" ? t("state.countdownDate") : t("state.countdownStart");
    case "highlights":
      return t("state.highlights", n(page.highlights.filter((h) => h.label.trim()).length));
    case "about":
      return t("state.about");
    case "included":
      return t("state.tickets", n(product.tiers.filter((x) => x.active && (x.note?.trim() || (x.perks?.length ?? 0) > 0)).length));
    case "know":
      return page.info.some((i) => i.label.trim() && i.value.trim())
        ? t("state.knowMore", n(page.info.filter((i) => i.label.trim() && i.value.trim()).length))
        : t("state.know");
    case "lineup":
    case "schedule":
      return t("state.lineup", n(page.lineup.filter((l) => l.name.trim()).length));
    case "gallery":
      return t("state.gallery", n(product.images.length));
    case "video":
      return t("state.video");
    case "venue":
      return product.event?.venueName?.trim() || t("state.venue");
    case "faq":
      return t("state.faq", n(page.faq.filter((f) => f.q.trim() && f.a.trim()).length));
    case "sponsors":
      return t("state.sponsors", n(page.sponsors.filter((s) => s.name.trim()).length));
    case "host":
      return page.blocks?.host?.name.trim() || t("state.empty");
    default:
      return "";
  }
}

/**
 * The sections of the page (docs/page-design.md).
 *
 * "On your page" is the sections that show, in the order the page draws them.
 * Each row is ONE button that opens its editor, and only one editor is open at
 * a time. Where a section sits is changed at the foot of its open editor (Move
 * up, Move down), beside Remove from page, so a row carries nothing but a drag
 * handle, an icon, a name, a line saying what is in it, and a chevron: it never
 * wraps in a 360px column. Dragging is optional; Move up and Move down do the
 * same job from the keyboard.
 *
 * "Add to your page" is a wrap of chips for the rest. Pressing one puts the
 * section on the page and opens it, so a section can no longer be filled in
 * while hidden.
 */
export function SectionList({
  product,
  page,
  onPage,
  onDescription,
  onEditDetails,
  onEditTickets,
  onDays,
}: {
  product: Product;
  page: ProductPage;
  onPage: (next: ProductPage) => void;
  onDescription?: (next: string) => void;
  onEditDetails?: () => void;
  onEditTickets?: () => void;
  /** Writes the event's days (`product.event.days`): a day's name and hours,
   *  edited in the Programme. Without it the Programme edits sessions only. */
  onDays?: (days: EventDay[]) => void;
}) {
  const t = useTranslations("catalog.page");
  const [open, setOpen] = useState<string>("");
  const [dragId, setDragId] = useState<PageSectionId | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  const { shown, hidden: available } = rowsOf(page);

  /* After a move the row is at a new place; hand the keyboard back to the same
     button (or its partner when it has hit an end), so Move up can be pressed
     again and again. */
  useEffect(() => {
    const want = refocus.current;
    if (!want || !list.current) return;
    refocus.current = null;
    const [id, dir] = want.split(":");
    const pick = (d: string) => list.current?.querySelector<HTMLButtonElement>(`[data-move="${id}:${d}"]:not(:disabled)`);
    (pick(dir) ?? pick(dir === "up" ? "down" : "up"))?.focus();
  }, [page.sections]);

  const labelOf = (id: PageSectionId) => t(`section.${id}`);

  const ctx = (id: PageSectionId): EditorCtx => ({
    product,
    page,
    onChange: (patch) => onPage(edited(page, id, patch)),
    onPage,
    onDescription: onDescription ? (v) => { onDescription(v); onPage(edited(page, id, {})); } : undefined,
    onEditDetails,
    onEditTickets,
    onDays,
  });

  const row = (id: PageSectionId) => {
    const name = labelOf(id);
    const Icon = ICON[id] ?? FileText;
    const required = isRequired(id);
    const sample = rowHasSample(page, id);
    const fill = sectionFill(id, product, page);
    const up = canMove(page, id, -1);
    const down = canMove(page, id, 1);
    const isOpen = open === id;
    const move = (dir: -1 | 1) => {
      refocus.current = `${id}:${dir === -1 ? "up" : "down"}`;
      onPage(moveSection(page, id, dir));
    };
    return (
      <div
        key={id}
        data-section={id}
        onDragOver={(e) => { if (dragId && dragId !== id) e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId) onPage(moveBefore(page, dragId, id));
          setDragId(null);
        }}
        className={cn("border-b border-hairline last:border-0", dragId === id && "opacity-50")}
      >
        <div className="flex items-center pl-tight">
          {id !== "hero" ? (
            <span
              aria-hidden
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", id);
                e.dataTransfer.effectAllowed = "move";
                setDragId(id);
              }}
              onDragEnd={() => setDragId(null)}
              className="hidden h-11 w-5 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing md:flex"
            >
              <GripVertical size={16} strokeWidth={1.5} />
            </span>
          ) : (
            <span aria-hidden className="hidden w-5 shrink-0 md:block" />
          )}
          <button
            type="button"
            onClick={() => setOpen(isOpen ? "" : id)}
            aria-expanded={isOpen}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-tight rounded-sm px-tight py-tight text-left transition-colors duration-quick hover:bg-muted-wash"
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{name}</span>
              <span className="block truncate text-sm text-muted">{stateOf(id, product, page, t)}</span>
            </span>
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", isOpen && "rotate-180")} />
          </button>
        </div>
        {isOpen && (
          <div className="flex flex-col gap-comfortable bg-subtle px-comfortable pb-comfortable pt-tight">
            {sample && (
              <div className="flex flex-wrap items-center justify-between gap-tight">
                <p className="min-w-0 flex-1 text-sm text-fg">{t("sampleNote")}</p>
                <Button variant="secondary" size="sm" onClick={() => onPage(keepSample(page, id))}>
                  {t("keepSample")}
                </Button>
              </div>
            )}
            {!sample && fill === "empty" && id !== "hero" && <Note>{t("emptyNote")}</Note>}
            <SectionBody id={id} ctx={ctx(id)} />
            {id !== "hero" && (
              <div className="flex flex-wrap items-center gap-tight border-t border-hairline pt-comfortable">
                <Button
                  variant="secondary"
                  size="sm"
                  data-move={`${id}:up`}
                  aria-label={t("moveUp", { name })}
                  title={up ? t("moveUp", { name }) : t("alreadyFirst")}
                  disabled={!up}
                  onClick={() => move(-1)}
                  icon={<ArrowUp size={15} strokeWidth={1.5} aria-hidden />}
                >
                  {t("moveUpText")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  data-move={`${id}:down`}
                  aria-label={t("moveDown", { name })}
                  title={down ? t("moveDown", { name }) : t("alreadyLast")}
                  disabled={!down}
                  onClick={() => move(1)}
                  icon={<ArrowDown size={15} strokeWidth={1.5} aria-hidden />}
                >
                  {t("moveDownText")}
                </Button>
                {!required && (
                  <Button
                    variant="tertiary"
                    size="sm"
                    className="text-danger sm:ml-auto"
                    aria-label={t("removeFromPageFor", { name })}
                    onClick={() => {
                      setOpen("");
                      onPage(removeSection(page, id));
                    }}
                  >
                    {t("removeFromPage")}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col gap-tight">
        <h3 className="text-md font-semibold text-fg">{t("onPage")}</h3>
        <p className="text-sm text-muted">{t("onPageHelp")}</p>
        <div ref={list} className="overflow-hidden rounded-inner border border-line bg-card">
          {shown.map((id) => row(id))}
        </div>
      </div>

      {available.length > 0 && (
        <div className="flex flex-col gap-tight">
          <h3 className="text-md font-semibold text-fg">{t("addHeading")}</h3>
          <ul className="flex flex-wrap gap-tight">
            {available.map((id) => {
              const Icon = ICON[id] ?? FileText;
              const name = labelOf(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-add={id}
                    aria-label={t("addSection", { name })}
                    onClick={() => {
                      onPage(addSection(page, product, id));
                      setOpen(id);
                    }}
                    className="inline-flex min-h-9 items-center gap-inline rounded-control border border-line bg-card px-comfortable text-sm font-medium text-fg transition-colors duration-quick hover:bg-muted-wash"
                  >
                    <Plus size={14} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                    <Icon size={15} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
