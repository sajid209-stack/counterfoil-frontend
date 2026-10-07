"use client";

/**
 * The rooms an operator has drawn.
 *
 * Two things this page used to get wrong. It described every plan as
 * "6×10 · 60 seats" — a rows-by-columns figure that means nothing about a
 * dining room and is not even true of a hall with an aisle. And "New layout"
 * created one immediately, so a plan could only ever start as the generic
 * template; the kind of room is the question that decides what can be placed
 * on it, so it is asked first.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button, EmptyState, Modal, PlanView, useToast, seatToElement } from "@/components/ui";
import { PageShell, type PagePrimary } from "@/components/ui/PageShell";
import { useApiQuery } from "@/lib/useApi";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { createSeatLayout, listSeatLayouts } from "@/lib/api";
import type { LayoutExperience, SeatLayout } from "@/lib/api";
import { EXPERIENCES, planCapacity } from "@/lib/layout";

export default function SeatLayoutsPage() {
  const t = useTranslations("seatmaps");
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => listSeatLayouts({ pageSize: 100 }), []);
  const [choosing, setChoosing] = useState(false);
  const [creating, setCreating] = useState<LayoutExperience | null>(null);
  const layouts = q.data?.data ?? [];
  const wide = useMediaQuery(MD);

  const create = async (experience: LayoutExperience) => {
    setCreating(experience);
    const res = await createSeatLayout({
      name: t(`newName.${experience}`),
      locationId: null,
      /* The room's rough size. Nothing places a seat from these any more — the
         plan's own coordinates do — and the designer rewrites them from the
         plan's bounding box on every save. */
      rows: 6,
      seatsPerRow: 10,
      rowLabels: ["A", "B", "C", "D", "E", "F"],
      bufferAfterMinutes: 15,
      experience,
    });
    setCreating(null);
    setChoosing(false);
    if (res.ok) {
      toast.success(t("list.created"));
      router.push(`/catalog/layouts/${res.data.id}`);
    } else toast.error(res.error.message);
  };

  const primary: PagePrimary = { label: t("list.new"), onClick: () => setChoosing(true) };

  return (
    <PageShell title={t("list.title")} description={t("list.description")} primary={primary}>
      {q.loading ? (
        <div aria-busy="true" className="grid gap-section sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-md bg-subtle" />)}
        </div>
      ) : layouts.length === 0 ? (
        <EmptyState title={t("list.empty")} action={<Button onClick={() => setChoosing(true)}>{t("list.new")}</Button>} />
      ) : (
        <div className="grid gap-section sm:grid-cols-2 lg:grid-cols-3">
          {/* A gallery's own way to make another: the first tile. It has no
              toolbar to carry a button, and a strip above the grid would hold
              only that. A phone has the bar's plus. */}
          {wide && (
            <button
              type="button"
              onClick={primary.onClick}
              className="flex min-h-40 items-center justify-center gap-tight rounded-md border border-dashed border-strong p-card text-sm font-medium text-brand-foreground transition-colors duration-quick hover:bg-muted-wash"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden />
              {primary.label}
            </button>
          )}
          {layouts.map((l) => (
            <LayoutCard key={l.id} layout={l} onOpen={() => router.push(`/catalog/layouts/${l.id}`)} />
          ))}
        </div>
      )}

      <Modal open={choosing} onClose={() => setChoosing(false)} title={t("list.chooseTitle")} description={t("list.chooseHelp")}>
        <div className="grid gap-tight sm:grid-cols-2">
          {EXPERIENCES.map((x) => (
            <button
              key={x}
              type="button"
              disabled={!!creating}
              onClick={() => create(x)}
              className="flex min-h-11 flex-col items-start gap-[2px] rounded-sm border border-line p-comfortable text-left hover:bg-muted-wash disabled:opacity-50"
            >
              <span className="font-medium">{t(`experience.${x}`)}</span>
              <span className="text-[12px] text-muted">{t(`experienceHint.${x}`)}</span>
            </button>
          ))}
        </div>
      </Modal>
    </PageShell>
  );
}

/** A plan, as a picture. The name and a number cannot say whether the room is a
 *  grid of seats or a dining room; 200px of the plan itself can. */
function LayoutCard({ layout: l, onOpen }: { layout: SeatLayout; onOpen: () => void }) {
  const t = useTranslations("seatmaps");
  const colorOf = (uid: string | null) => l.categories.find((c) => c.uid === uid)?.color ?? null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-tight card-surface p-card text-left transition-colors duration-quick hover:border-ember/40"
    >
      <div className="flex items-baseline gap-tight">
        <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
        <span className="shrink-0 text-[12px] text-muted">{t(`experience.${l.experience ?? "general"}`)}</span>
      </div>
      <div aria-hidden className="pointer-events-none overflow-hidden rounded-xs border border-hairline bg-surface">
        <PlanView
          elements={l.seats.map((s) => seatToElement(s, colorOf(s.seatCategoryId)))}
          fixtures={l.fixtures ?? []}
          minHeight={120}
          maxScale={14}
        />
      </div>
      <span className="text-[12px] text-muted">{t("list.capacity", { count: planCapacity(l.seats) })}</span>
      <div className="flex flex-wrap gap-inline">
        {l.categories.map((c) => (
          /* Tinted ground, theme ink. The colour is the operator's own, so it
             cannot be guaranteed readable as a letterform — blue measured
             2.79:1 on a dark card. */
          <span key={c.uid} className="inline-flex items-center rounded-xs px-inline py-[2px] text-[12px]" style={{ background: `${c.color}22` }}>
            {c.name}
          </span>
        ))}
      </div>
    </button>
  );
}
