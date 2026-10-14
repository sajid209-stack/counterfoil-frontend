"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  GripVertical,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  ListChecks,
  MapPin,
  Play,
  Sparkles,
  Ticket,
  Users,
  Hash,
  Handshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { categoryById, type CategoryId } from "@/lib/events/catalog";
import type { PageSectionId, Product, ProductPage } from "@/lib/api/types";
import { canMove, edited, isRequired, keepSample, moveBefore, moveSection, rowsOf, toggleSection } from "./pageOps";
import { SectionBody, type EditorCtx } from "./SectionEditors";

const ICON: Record<PageSectionId, LucideIcon> = {
  hero: ImageIcon,
  countdown: Clock,
  stats: Hash,
  highlights: Sparkles,
  about: FileText,
  included: ListChecks,
  know: Info,
  lineup: Users,
  schedule: Users,
  gallery: LayoutGrid,
  video: Play,
  sponsors: Handshake,
  tickets: Ticket,
  venue: MapPin,
  faq: HelpCircle,
};

/**
 * The sections of the page, in the order the page draws them, with the hidden
 * ones listed after. Each row is the whole control for one section: where it
 * sits (a drag handle AND move up / move down — dragging is never the only
 * way), whether it shows, and the words in it, edited in place.
 */
export function SectionList({
  product,
  page,
  onPage,
  onDescription,
  onEditDetails,
  onEditTickets,
}: {
  product: Product;
  page: ProductPage;
  onPage: (next: ProductPage) => void;
  onDescription?: (next: string) => void;
  onEditDetails?: () => void;
  onEditTickets?: () => void;
}) {
  const t = useTranslations("catalog.page");
  const te = useTranslations("events");
  const [open, setOpen] = useState<string>("");
  const [dragId, setDragId] = useState<PageSectionId | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const refocus = useRef<string | null>(null);
  const { shown, hidden } = rowsOf(page);

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

  const labelOf = (id: PageSectionId) => {
    if (id === "lineup" && page.look !== "standard") return te(`section.${categoryById(page.look as CategoryId).lineupKey}`);
    return t(`section.${id}`);
  };

  const ctx = (id: PageSectionId): EditorCtx => ({
    product,
    page,
    onChange: (patch) => onPage(edited(page, id, patch)),
    onDescription: onDescription ? (v) => { onDescription(v); onPage(edited(page, id, {})); } : undefined,
    onEditDetails,
    onEditTickets,
  });

  const row = (id: PageSectionId, isShown: boolean) => {
    const name = labelOf(id);
    const Icon = ICON[id];
    const required = isRequired(id);
    const sample = isShown && !!page.samples?.includes(id);
    const sub = !isShown ? t("hiddenRow") : id === "hero" ? t("heroRow") : required ? t("alwaysShown") : null;
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
        onDragOver={(e) => { if (dragId && dragId !== id && isShown) e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          if (dragId && isShown) onPage(moveBefore(page, dragId, id));
          setDragId(null);
        }}
        className={cn("border-b border-hairline last:border-0", dragId === id && "opacity-50")}
      >
        <div className="flex items-center gap-inline pl-comfortable pr-inline">
          {isShown && id !== "hero" ? (
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
              <span className={cn("flex flex-wrap items-center gap-x-tight text-sm font-medium", isShown ? "text-fg" : "text-muted")}>
                {name}
                {sample && <StatusPill tone="warning">{t("sample")}</StatusPill>}
              </span>
              {sub && <span className="block text-xs text-muted">{sub}</span>}
            </span>
            <ChevronDown size={16} strokeWidth={1.5} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", isOpen && "rotate-180")} />
          </button>
          <span className="flex shrink-0 items-center">
            {id === "hero" ? (
              <span aria-hidden className="h-11 w-33 shrink-0 md:h-9 md:w-27" />
            ) : required ? (
              <span aria-hidden className="h-11 w-11 shrink-0 md:h-9 md:w-9" />
            ) : (
            <Button
              variant="tertiary"
              size="icon"
              aria-label={isShown ? t("hide", { name }) : t("show", { name })}
              title={isShown ? t("hide", { name }) : t("show", { name })}
              onClick={() => onPage(toggleSection(page, id))}
              className="text-muted"
            >
              {isShown ? <Eye size={16} strokeWidth={1.5} aria-hidden /> : <EyeOff size={16} strokeWidth={1.5} aria-hidden />}
            </Button>
            )}
            {id !== "hero" && isShown && (
              <>
                <Button
                  variant="tertiary"
                  size="icon"
                  data-move={`${id}:up`}
                  aria-label={t("moveUp", { name })}
                  title={up ? t("moveUp", { name }) : t("alreadyFirst")}
                  disabled={!up}
                  onClick={() => move(-1)}
                  className="text-muted"
                >
                  <ArrowUp size={15} strokeWidth={1.5} aria-hidden />
                </Button>
                <Button
                  variant="tertiary"
                  size="icon"
                  data-move={`${id}:down`}
                  aria-label={t("moveDown", { name })}
                  title={down ? t("moveDown", { name }) : t("alreadyLast")}
                  disabled={!down}
                  onClick={() => move(1)}
                  className="text-muted"
                >
                  <ArrowDown size={15} strokeWidth={1.5} aria-hidden />
                </Button>
              </>
            )}
          </span>
        </div>
        {isOpen && (
          <div className="flex flex-col gap-section bg-subtle px-comfortable pb-card pt-tight">
            {sample && (
              <div className="flex flex-wrap items-center justify-between gap-tight rounded-sm bg-warning-wash px-comfortable py-tight">
                <p className="min-w-0 flex-1 text-sm text-fg">{t("sampleNote")}</p>
                <Button variant="secondary" size="sm" onClick={() => onPage(keepSample(page, id))}>
                  {t("keepSample")}
                </Button>
              </div>
            )}
            {!isShown && <p className="text-sm text-muted">{t("hiddenNote")}</p>}
            <SectionBody id={id} ctx={ctx(id)} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-tight">
      <h3 className="text-sm font-semibold text-fg">{t("sections")}</h3>
      <p className="text-sm text-muted">{t("sectionsHelp")}</p>
      <div ref={list} className="overflow-hidden rounded-sm border border-line bg-card">
        {shown.map((id) => row(id, true))}
        {hidden.length > 0 && (
          <>
            <p className="border-b border-hairline bg-subtle px-comfortable py-tight text-sm font-medium text-muted">{t("hiddenHeading", { count: hidden.length })}</p>
            {hidden.map((id) => row(id, false))}
          </>
        )}
      </div>
    </div>
  );
}
