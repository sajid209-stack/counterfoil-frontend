"use client";

/**
 * The floor-plan designer.
 *
 * What it replaces was a fixed rows × columns grid with three paint tools and a
 * "SCREEN" banner printed above it. That can describe one shape of room — a
 * rectangle of identical seats with a screen at the front — and nothing else.
 * It could not make an aisle, move anything, seat a table, put the stage at the
 * side, or draw a dining room at all.
 *
 * The three rules this is built on:
 *
 *  1. **The geometry is shared.** Positions, hit testing, the palettes and the
 *     templates live in `lib/layout`, and the drawing is `PlanView` — the same
 *     component the till's picker uses. An operator and a customer cannot be
 *     shown different rooms.
 *
 *  2. **Dragging is never the only way.** WCAG 2.2 requires a single-pointer
 *     alternative for every drag, so everything a pointer can do to a selection
 *     the inspector can do with a number, and the arrow keys nudge. A canvas
 *     that can only be driven by dragging is a canvas some people cannot use.
 *
 *  3. **A table is one sellable thing whose capacity is its covers.** A
 *     restaurant books table 7 for four; a theatre sells seat A12. Drawing four
 *     chairs round a fixture would make "what did they buy" ambiguous.
 */
import { useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Armchair,
  Copy,
  DoorOpen,
  Grid2x2,
  LayoutGrid,
  Maximize2,
  Minus,
  Plus,
  RectangleHorizontal,
  Redo2,
  RotateCw,
  Rows3,
  Sofa,
  Square,
  Trash2,
  Type as TypeIcon,
  Undo2,
  Wine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, ConfirmDialog, EmptyState, FormField, PageShell, PlanView, useToast, seatToElement } from "@/components/ui";
import type { PlanElement } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getSeatLayout, saveLayoutPlan, updateSeatLayout } from "@/lib/api";
import type { LayoutExperience, LayoutFixture, LayoutSeat, SeatCategory, SeatLayout } from "@/lib/api";
import {
  boxesIn,
  EXPERIENCES,
  hitTest,
  makeFixture,
  makeGa,
  makeSeat,
  makeTable,
  PALETTES,
  planCapacity,
  planExtent,
  rowLabel,
  seatBlock,
  seatRow,
  snap,
  TEMPLATES,
  type Extent,
  type PaletteTool,
} from "@/lib/layout";
import { cn } from "@/lib/cn";

const PALETTE_COLORS = ["#F94A00", "#2563EB", "#16A34A", "#7C3AED", "#D97706", "#BE185D"];

export default function SeatLayoutEditorPage() {
  const t = useTranslations("seatmaps");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const q = useApiQuery(() => getSeatLayout(params.id), [params.id]);

  if (q.loading) {
    return (
      <PageShell title={t("editor.backToList")}>
        <div className="h-96 animate-pulse rounded-md bg-subtle" />
      </PageShell>
    );
  }
  if (q.error || !q.data) {
    return (
      <PageShell title={t("editor.backToList")}>
        <EmptyState title={t("editor.notFound")} action={<Button onClick={() => router.push("/catalog/layouts")}>{t("editor.backToList")}</Button>} />
      </PageShell>
    );
  }
  /* Keyed by the record, so every piece of edit state is seeded by its own lazy
     initialiser from real data. The page this replaces copied the record into
     state inside an effect, which is an error in this repo and was on its
     documented lint baseline. */
  return <Designer key={q.data.id} layout={q.data} reload={q.reload} />;
}

/* ── The editor ──────────────────────────────────────────────────────────── */

interface Plan {
  seats: LayoutSeat[];
  fixtures: LayoutFixture[];
  categories: SeatCategory[];
}

function Designer({ layout, reload }: { layout: SeatLayout; reload: () => void }) {
  const t = useTranslations("seatmaps");
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(layout.name);
  const [buffer, setBuffer] = useState(layout.bufferAfterMinutes);
  const [experience, setExperience] = useState<LayoutExperience>(layout.experience ?? "general");
  const [plan, setPlan] = useState<Plan>({
    seats: layout.seats,
    fixtures: layout.fixtures ?? [],
    categories: layout.categories,
  });
  const [past, setPast] = useState<Plan[]>([]);
  const [future, setFuture] = useState<Plan[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  const [tool, setTool] = useState<PaletteTool | null>(null);
  const [scale, setScale] = useState(26);
  const [snapOn, setSnapOn] = useState(true);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const [marquee, setMarquee] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmTemplate, setConfirmTemplate] = useState(false);

  /* Pointer bookkeeping. Written and read only inside handlers, never during
     render — the React Compiler forbids the latter. */
  const gesture = useRef<null | { mode: "move" | "marquee"; ox: number; oy: number; moved: boolean }>(null);

  /* ── history ─────────────────────────────────────────────────────────── */
  const commit = (next: Plan) => {
    setPast((p) => [...p.slice(-39), plan]);
    setFuture([]);
    setPlan(next);
  };
  const undo = () => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [plan, ...f]);
      setPlan(prev);
      return p.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setPast((p) => [...p, plan]);
      setPlan(f[0]);
      return f.slice(1);
    });
  };

  /* ── the working area ────────────────────────────────────────────────── */
  /* Derived from the COMMITTED plan, never from what is being dragged: an
     extent that follows the pointer shifts the whole room under it. It also
     never shrinks below a generous room, so there is empty canvas to drop the
     first element onto. */
  const extent: Extent = useMemo(() => {
    const e = planExtent([...plan.seats, ...plan.fixtures], 1.5);
    const minX = Math.min(e.minX, -1);
    const minY = Math.min(e.minY, -1);
    const maxX = Math.max(e.maxX, minX + 22);
    const maxY = Math.max(e.maxY, minY + 14);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [plan.seats, plan.fixtures]);

  const catOf = (uid: string | null) => plan.categories.find((c) => c.uid === uid);
  const selSet = new Set(sel);
  const grain = snapOn ? 0.5 : 0.1;
  const fix = (v: number) => (snapOn ? snap(v, 0.5) : Math.round(v * 10) / 10);

  /* What is drawn: the plan, with any drag applied to the selection. */
  const shown = useMemo(() => {
    const move = <T extends { id: string; posX: number; posY: number }>(it: T): T =>
      drag && selSet.has(it.id) ? { ...it, posX: fix(it.posX + drag.dx), posY: fix(it.posY + drag.dy) } : it;
    return { seats: plan.seats.map(move), fixtures: plan.fixtures.map(move) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.seats, plan.fixtures, drag, sel, snapOn]);

  const elements: PlanElement[] = shown.seats.map((s) => seatToElement(s, catOf(s.seatCategoryId)?.color ?? null));

  /* ── placing ─────────────────────────────────────────────────────────── */
  const nextRowIndex = () => {
    const used = new Set(plan.seats.map((s) => s.seatRow).filter(Boolean));
    let i = 0;
    while (used.has(rowLabel(i))) i++;
    return i;
  };
  const nextTableNumber = () => plan.seats.filter((s) => (s.kind ?? "seat") === "table").length + 1;
  const defaultCat = () => plan.categories[0]?.uid ?? null;

  const place = (x: number, y: number) => {
    if (!tool) return;
    const px = fix(x);
    const py = fix(y);
    const c = defaultCat();
    if (tool.kind === "fixture") {
      const f = makeFixture(tool.fixture, px, py);
      commit({ ...plan, fixtures: [...plan.fixtures, f] });
      setSel([f.id]);
      return;
    }
    let made: LayoutSeat[] = [];
    if (tool.kind === "seat") {
      const r = rowLabel(nextRowIndex());
      made = [makeSeat({ name: `${r}1`, seatRow: r, seatNumber: 1, posX: px, posY: py, categoryUid: c })];
    } else if (tool.kind === "row") {
      made = seatRow({ row: rowLabel(nextRowIndex()), count: tool.count, posX: px, posY: py, curve: tool.curve, categoryUid: c });
    } else if (tool.kind === "block") {
      made = seatBlock({ rows: tool.rows, perRow: tool.perRow, posX: px, posY: py, curve: tool.curve, categoryUid: c, firstRow: nextRowIndex() });
    } else if (tool.kind === "table") {
      made = [makeTable({ name: `T${nextTableNumber()}`, covers: tool.covers, shape: tool.shape, posX: px, posY: py, categoryUid: c })];
    } else if (tool.kind === "ga") {
      made = [makeGa(t("editor.gaName"), px, py, tool.capacity, c)];
    }
    if (!made.length) return;
    const from = plan.seats.length;
    made.forEach((s, i) => (s.assignOrder = from + i));
    commit({ ...plan, seats: [...plan.seats, ...made] });
    setSel(made.map((s) => s.id));
  };

  /* ── pointer ─────────────────────────────────────────────────────────── */
  /**
   * Pointer → canvas units, measured against the plan's own surface.
   *
   * Not against the box around it: the surface is centred when it is narrower
   * than the column and it shifts when the box scrolls, so measuring the
   * wrapper drops everything by that offset.
   */
  const toUnits = (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    const surface =
      t.closest<HTMLElement>("[data-plan-surface]") ??
      (e.currentTarget as HTMLElement).querySelector<HTMLElement>("[data-plan-surface]");
    const r = (surface ?? (e.currentTarget as HTMLElement)).getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale + extent.minX, y: (e.clientY - r.top) / scale + extent.minY };
  };

  const beginMove = (id: string, x: number, y: number, additive: boolean) => {
    setSel((s) => (additive ? (s.includes(id) ? s.filter((i) => i !== id) : [...s, id]) : s.includes(id) ? s : [id]));
    gesture.current = { mode: "move", ox: x, oy: y, moved: false };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const host = e.currentTarget;
    const { x, y } = toUnits(e);
    if (tool) {
      place(x, y);
      setTool(null);
      return;
    }
    /* The elements are buttons, so one of them may have taken this already —
       see `onElementDown`. Only a press on bare canvas reaches here as a miss. */
    const hit = hitTest([...plan.fixtures, ...plan.seats], x, y);
    host.setPointerCapture(e.pointerId);
    if (hit) beginMove(hit.id, x, y, e.shiftKey || e.metaKey || e.ctrlKey);
    else {
      if (!e.shiftKey) setSel([]);
      gesture.current = { mode: "marquee", ox: x, oy: y, moved: false };
      setMarquee({ ax: x, ay: y, bx: x, by: y });
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    const { x, y } = toUnits(e);
    if (Math.abs(x - g.ox) > 0.15 || Math.abs(y - g.oy) > 0.15) g.moved = true;
    if (g.mode === "move") setDrag({ dx: x - g.ox, dy: y - g.oy });
    else setMarquee({ ax: g.ox, ay: g.oy, bx: x, by: y });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.mode === "move") {
      if (g.moved && drag) commit({ ...plan, seats: shown.seats, fixtures: shown.fixtures });
      setDrag(null);
    } else {
      const m = marquee;
      setMarquee(null);
      if (g.moved && m) {
        const a = { x: m.ax, y: m.ay };
        const b = { x: m.bx, y: m.by };
        const ids = [...boxesIn(plan.fixtures, a, b), ...boxesIn(plan.seats, a, b)].map((i) => i.id);
        setSel((s) => (e.shiftKey ? [...new Set([...s, ...ids])] : ids));
      }
    }
  };

  /* ── editing the selection ───────────────────────────────────────────── */
  const selSeats = plan.seats.filter((s) => selSet.has(s.id));
  const selFixtures = plan.fixtures.filter((f) => selSet.has(f.id));
  /* Held apart rather than as one narrowed union: a seat and a fixture have
     genuinely different inspectors — one has a category and covers, the other
     has a piece of text — so the two bindings read better than a predicate. */
  const only = selSeats.length + selFixtures.length === 1;
  const oneSeat = only && selSeats.length === 1 ? selSeats[0] : null;
  const oneFixture = only && selFixtures.length === 1 ? selFixtures[0] : null;
  /** The geometry both kinds share, which is what the position fields edit. */
  const geo: { posX: number; posY: number; width?: number; height?: number; rotation?: number } | null =
    oneSeat ?? oneFixture;

  const nudge = (dx: number, dy: number) => {
    if (!sel.length) return;
    const shift = (it: LayoutSeat | LayoutFixture) =>
      selSet.has(it.id) ? { ...it, posX: Math.round((it.posX + dx) * 10) / 10, posY: Math.round((it.posY + dy) * 10) / 10 } : it;
    commit({ ...plan, seats: plan.seats.map(shift) as LayoutSeat[], fixtures: plan.fixtures.map(shift) as LayoutFixture[] });
  };

  /* `kind` is the one member whose types conflict between the two, and nothing
     here changes what a thing IS — so it is left out and the intersection stays
     inhabited. */
  type PlanPatch = Partial<Omit<LayoutSeat, "kind">> & Partial<Omit<LayoutFixture, "kind">>;
  const patchSel = (patch: PlanPatch) => {
    commit({
      ...plan,
      seats: plan.seats.map((s) => (selSet.has(s.id) ? { ...s, ...(patch as Partial<LayoutSeat>) } : s)),
      fixtures: plan.fixtures.map((f) => (selSet.has(f.id) ? { ...f, ...(patch as Partial<LayoutFixture>) } : f)),
    });
  };

  const removeSel = () => {
    if (!sel.length) return;
    commit({ ...plan, seats: plan.seats.filter((s) => !selSet.has(s.id)), fixtures: plan.fixtures.filter((f) => !selSet.has(f.id)) });
    setSel([]);
  };

  const duplicateSel = () => {
    if (!sel.length) return;
    const seats = selSeats.map((s) => ({ ...makeSeat({ ...s, kind: s.kind, categoryUid: s.seatCategoryId, posX: s.posX + 1, posY: s.posY + 1 }), name: s.name }));
    const fixtures = selFixtures.map((f) => makeFixture(f.kind, f.posX + 1, f.posY + 1, { label: f.label, width: f.width, height: f.height, rotation: f.rotation }));
    commit({ ...plan, seats: [...plan.seats, ...seats], fixtures: [...plan.fixtures, ...fixtures] });
    setSel([...seats, ...fixtures].map((x) => x.id));
  };

  const rotateSel = () => patchSel({ rotation: ((geo?.rotation ?? 0) + 90) % 360 });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 1 : grain;
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
    };
    if (keys[e.key]) { e.preventDefault(); nudge(...keys[e.key]); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSel(); return; }
    if (e.key === "Escape") { setSel([]); setTool(null); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); }
  };

  /* ── categories ──────────────────────────────────────────────────────── */
  const addCategory = () => {
    const uid = `cat_${globalThis.crypto.randomUUID().slice(0, 6)}`;
    commit({
      ...plan,
      categories: [...plan.categories, { uid, name: t("editor.newCategory"), color: PALETTE_COLORS[plan.categories.length % PALETTE_COLORS.length], price: 0, pricingMode: "fixed", isGeneralAdmission: false }],
    });
  };
  const patchCategory = (uid: string, patch: Partial<SeatCategory>) =>
    setPlan((p) => ({ ...p, categories: p.categories.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }));
  const removeCategory = (uid: string) =>
    commit({
      ...plan,
      categories: plan.categories.filter((c) => c.uid !== uid),
      seats: plan.seats.map((s) => (s.seatCategoryId === uid ? { ...s, seatCategoryId: null } : s)),
    });

  const applyTemplate = () => {
    const p = TEMPLATES[experience]();
    commit({ seats: p.seats, fixtures: p.fixtures, categories: p.categories });
    setSel([]);
    setConfirmTemplate(false);
  };

  /* ── save ────────────────────────────────────────────────────────────── */
  const save = async () => {
    setSaving(true);
    const e = planExtent([...plan.seats, ...plan.fixtures], 0);
    await updateSeatLayout(layout.id, {
      name,
      bufferAfterMinutes: buffer,
      experience,
      /* The legacy grid fields stay on the contract and are kept meaningful:
         the plan's own bounding box, rounded up. Nothing reads them to place a
         seat any more — they are the room's rough size. */
      rows: Math.max(1, Math.ceil(e.height)),
      seatsPerRow: Math.max(1, Math.ceil(e.width)),
    });
    const res = await saveLayoutPlan(layout.id, plan.seats, plan.categories, plan.fixtures);
    setSaving(false);
    if (res.ok) { toast.success(t("editor.saved")); reload(); }
    else toast.error(res.error.message);
  };

  const capacity = planCapacity(plan.seats);
  const uncategorised = plan.seats.filter((s) => !s.seatCategoryId).length;

  return (
    <PageShell
      title={name || t("editor.backToList")}
      description={t("editor.description")}
      actions={<Button loading={saving} onClick={save}>{t("editor.save")}</Button>}
    >
      <button type="button" onClick={() => router.push("/catalog/layouts")} className="mb-section inline-flex min-h-11 items-center gap-inline text-[13px] text-muted hover:text-fg sm:min-h-0">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("editor.backToList")}
      </button>

      <div className="flex flex-col gap-section">
        {/* What kind of room, and what it is called */}
        <div className="grid gap-section card-surface p-card sm:grid-cols-3">
          <FormField label={t("editor.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <FormField
            label={t("editor.experience")}
            variant="select"
            value={experience}
            options={EXPERIENCES.map((x) => ({ value: x, label: t(`experience.${x}`) }))}
            onChange={(e) => setExperience(e.target.value as LayoutExperience)}
            help={t("editor.experienceHelp")}
          />
          <FormField label={t("editor.buffer")} variant="number" value={String(buffer)} onChange={(e) => setBuffer(Math.max(0, parseInt(e.target.value) || 0))} />
        </div>

        {/* `grid-cols-1` and `min-w-0` on every child, both deliberate: a single
            implicit track sizes to max-content, so the canvas — which is as
            wide as the working area — dragged the whole column to 608px inside
            a 390px phone and 234px of it was swallowed by `main`. The same
            min-width:auto fault this project has now recorded five times. */}
        <div className="grid grid-cols-1 gap-section lg:grid-cols-[13rem_1fr_15rem]">
          {/* ── the palette ─────────────────────────────────────────────── */}
          <div className="min-w-0 card-surface p-card">
            <h2 className="type-label mb-tight">{t("editor.paletteTitle")}</h2>
            <p className="mb-comfortable text-[12px] text-muted">{tool ? t("editor.paletteArmed") : t("editor.paletteHelp")}</p>
            <div className="flex flex-wrap gap-tight lg:flex-col">
              {PALETTES[experience].map((it) => {
                const armed = tool?.id === it.id;
                return (
                  <button
                    key={it.id}
                    type="button"
                    aria-pressed={armed}
                    onClick={() => setTool(armed ? null : it)}
                    className={cn(
                      "flex min-h-11 flex-1 items-center gap-inline rounded-sm border px-comfortable text-left text-[13px] lg:flex-none",
                      armed ? "border-ember-solid bg-ember/10 text-brand-foreground" : "border-line hover:bg-muted-wash",
                    )}
                  >
                    <ToolIcon tool={it} />
                    <span className="truncate">{t(`tool.${it.id}`)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-section border-t border-hairline pt-comfortable">
              <Button size="sm" variant="secondary" onClick={() => setConfirmTemplate(true)}>{t("editor.useTemplate")}</Button>
              <p className="mt-inline text-[12px] text-muted">{t("editor.useTemplateHelp")}</p>
            </div>
          </div>

          {/* ── the canvas ──────────────────────────────────────────────── */}
          <div className="min-w-0 card-surface p-card">
            <div className="mb-comfortable flex flex-wrap items-center gap-tight">
              <span className="mr-auto text-[13px] text-muted">
                {t("editor.capacity", { count: capacity })}
                {uncategorised > 0 && <span className="text-warning"> · {t("editor.uncategorised", { count: uncategorised })}</span>}
              </span>
              <IconBtn label={t("editor.undo")} onClick={undo} disabled={!past.length}><Undo2 size={15} strokeWidth={1.5} /></IconBtn>
              <IconBtn label={t("editor.redo")} onClick={redo} disabled={!future.length}><Redo2 size={15} strokeWidth={1.5} /></IconBtn>
              <IconBtn label={t("editor.zoomOut")} onClick={() => setScale((s) => Math.max(10, s - 4))}><Minus size={15} strokeWidth={1.5} /></IconBtn>
              <IconBtn label={t("editor.zoomIn")} onClick={() => setScale((s) => Math.min(48, s + 4))}><Plus size={15} strokeWidth={1.5} /></IconBtn>
              <IconBtn label={t("editor.fit")} onClick={() => setScale(26)}><Maximize2 size={15} strokeWidth={1.5} /></IconBtn>
              <button
                type="button"
                aria-pressed={snapOn}
                onClick={() => setSnapOn((v) => !v)}
                className={cn("flex min-h-11 items-center gap-inline rounded-sm border px-comfortable text-[13px] md:min-h-9", snapOn ? "border-inverse bg-inverse text-inverse-fg" : "border-line")}
              >
                <Grid2x2 size={14} strokeWidth={1.5} /> {t("editor.snap")}
              </button>
            </div>

            <div
              role="application"
              aria-label={t("editor.canvasLabel")}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={cn(
                "relative touch-none rounded-sm border border-hairline bg-surface",
                tool ? "cursor-copy" : "cursor-default",
              )}
              data-focus-inset
            >
              <PlanView
                elements={elements}
                fixtures={shown.fixtures}
                extent={extent}
                scale={scale}
                minHeight={extent.height * scale}
                stateOf={(el) => (selSet.has(el.id) ? "selected" : el.color ? "available" : "idle")}
                labelOf={(el) => `${el.name || t("editor.elementName")}${el.capacity && el.capacity > 1 ? ` · ${el.capacity}` : ""}`}
                /* A keyboard activation only — `detail === 0` is a click the
                   browser made from Enter or Space. A mouse click is already
                   handled by the pointer press below, and acting on both would
                   collapse a shift-click selection to one element. */
                onPick={(el, e) => { if (e.detail === 0) setSel([el.id]); }}
                onElementPointerDown={(el, e) => {
                  if (e.button !== 0 || tool) return;
                  const { x, y } = toUnits(e);
                  e.stopPropagation();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  beginMove(el.id, x, y, e.shiftKey || e.metaKey || e.ctrlKey);
                }}
                dataAttr="designer"
                underlay={({ scale: s, extent: ex }) => (
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, var(--color-hairline) 1px, transparent 1px), linear-gradient(to bottom, var(--color-hairline) 1px, transparent 1px)",
                      backgroundSize: `${s}px ${s}px`,
                      backgroundPosition: `${-((ex.minX % 1) * s)}px ${-((ex.minY % 1) * s)}px`,
                      opacity: 0.6,
                    }}
                  />
                )}
                overlay={({ scale: s, extent: ex }) =>
                  marquee ? (
                    <div
                      aria-hidden
                      className="absolute border border-ember-solid bg-ember/10"
                      style={{
                        left: (Math.min(marquee.ax, marquee.bx) - ex.minX) * s,
                        top: (Math.min(marquee.ay, marquee.by) - ex.minY) * s,
                        width: Math.abs(marquee.bx - marquee.ax) * s,
                        height: Math.abs(marquee.by - marquee.ay) * s,
                      }}
                    />
                  ) : null
                }
              />
            </div>
            <p className="mt-tight text-[12px] text-muted">{t("editor.canvasHelp")}</p>
          </div>

          {/* ── the inspector ───────────────────────────────────────────── */}
          <div className="min-w-0 card-surface p-card">
            <h2 className="type-label mb-tight">{t("editor.inspectorTitle")}</h2>
            {!sel.length ? (
              <p className="text-[13px] text-muted">{t("editor.nothingSelected")}</p>
            ) : (
              <div className="flex flex-col gap-comfortable">
                <p className="text-[13px] text-muted">{t("editor.selected", { count: sel.length })}</p>

                {oneFixture && (
                  <FormField label={t("editor.fixtureLabel")} value={oneFixture.label} onChange={(e) => patchSel({ label: e.target.value })} />
                )}
                {oneSeat && (
                  <FormField label={t("editor.elementName")} value={oneSeat.name} onChange={(e) => patchSel({ name: e.target.value })} />
                )}

                {selSeats.length > 0 && (
                  <>
                    <FormField
                      label={t("editor.category")}
                      variant="select"
                      value={selSeats[0]?.seatCategoryId ?? ""}
                      options={[{ value: "", label: t("editor.noCategory") }, ...plan.categories.map((c) => ({ value: c.uid, label: c.name }))]}
                      onChange={(e) => patchSel({ seatCategoryId: e.target.value || null })}
                    />
                    {selSeats.some((s) => (s.kind ?? "seat") !== "seat") && (
                      <FormField
                        label={selSeats[0].kind === "table" ? t("editor.covers") : t("editor.capacityField")}
                        variant="number"
                        value={String(selSeats[0].capacity)}
                        onChange={(e) => patchSel({ capacity: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                    )}
                  </>
                )}

                {/* Every drag has a number beside it. This IS the WCAG 2.2
                    single-pointer alternative, not a convenience. */}
                {geo && (
                  <div className="grid grid-cols-2 gap-tight">
                    <FormField label={t("editor.x")} variant="number" value={String(geo.posX)} onChange={(e) => patchSel({ posX: parseFloat(e.target.value) || 0 })} />
                    <FormField label={t("editor.y")} variant="number" value={String(geo.posY)} onChange={(e) => patchSel({ posY: parseFloat(e.target.value) || 0 })} />
                    <FormField label={t("editor.w")} variant="number" value={String(geo.width ?? 1)} onChange={(e) => patchSel({ width: Math.max(0.25, parseFloat(e.target.value) || 1) })} />
                    <FormField label={t("editor.h")} variant="number" value={String(geo.height ?? 1)} onChange={(e) => patchSel({ height: Math.max(0.25, parseFloat(e.target.value) || 1) })} />
                  </div>
                )}

                <div className="flex flex-wrap gap-tight">
                  <Button size="sm" variant="secondary" icon={<RotateCw size={14} strokeWidth={1.5} />} onClick={rotateSel}>{t("editor.rotate")}</Button>
                  <Button size="sm" variant="secondary" icon={<Copy size={14} strokeWidth={1.5} />} onClick={duplicateSel}>{t("editor.duplicate")}</Button>
                </div>
                <div className="flex flex-wrap gap-tight">
                  <Button size="sm" variant="secondary" onClick={() => patchSel({ isAvailable: false })}>{t("editor.block")}</Button>
                  <Button size="sm" variant="secondary" onClick={() => patchSel({ isAvailable: true })}>{t("editor.unblock")}</Button>
                </div>
                <Button size="sm" variant="destructive" icon={<Trash2 size={14} strokeWidth={1.5} />} onClick={removeSel}>{t("editor.remove")}</Button>
              </div>
            )}
          </div>
        </div>

        {/* ── categories ────────────────────────────────────────────────── */}
        <div className="card-surface p-card">
          <div className="mb-section flex items-center justify-between gap-tight">
            <h2 className="type-h2 text-base">{t("editor.categoriesTitle")}</h2>
            <Button size="sm" icon={<Plus size={14} strokeWidth={1.5} />} onClick={addCategory}>{t("editor.addCategory")}</Button>
          </div>
          {!plan.categories.length && <p className="text-[13px] text-muted">{t("editor.noCategories")}</p>}
          <div className="flex flex-col gap-tight">
            {plan.categories.map((c) => (
              <div key={c.uid} className="flex flex-wrap items-end gap-tight rounded-sm border border-line p-comfortable">
                <input type="color" aria-label={t("editor.catColor")} value={c.color} onChange={(e) => patchCategory(c.uid, { color: e.target.value })} className="h-11 w-11 shrink-0 rounded-sm border border-line bg-card" />
                <div className="min-w-32 flex-1"><FormField label={t("editor.catName")} value={c.name} onChange={(e) => patchCategory(c.uid, { name: e.target.value })} /></div>
                <div className="w-28"><FormField label={t("editor.catPrice")} variant="number" value={String(c.price / 100)} onChange={(e) => patchCategory(c.uid, { price: Math.round((parseFloat(e.target.value) || 0) * 100) })} /></div>
                <label className="flex min-h-11 items-center gap-inline whitespace-nowrap text-[13px]">
                  <input type="checkbox" checked={c.isGeneralAdmission} onChange={(e) => patchCategory(c.uid, { isGeneralAdmission: e.target.checked })} className="h-4 w-4 accent-ember" />
                  {t("editor.catGa")}
                </label>
                <span className="text-[12px] text-muted">{t("editor.catCount", { count: plan.seats.filter((s) => s.seatCategoryId === c.uid).reduce((n, s) => n + (s.capacity || 1), 0) })}</span>
                <button type="button" aria-label={`${t("editor.removeCategory")} ${c.name}`} onClick={() => removeCategory(c.uid)} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-danger hover:bg-muted-wash"><Trash2 size={15} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmTemplate}
        title={t("editor.templateTitle")}
        message={t("editor.templateBody", { kind: t(`experience.${experience}`) })}
        confirmLabel={t("editor.templateConfirm")}
        destructive={false}
        onConfirm={applyTemplate}
        onClose={() => setConfirmTemplate(false)}
      />
    </PageShell>
  );
}

/* ── bits ────────────────────────────────────────────────────────────────── */

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-muted hover:bg-muted-wash disabled:opacity-40 md:h-9 md:w-9"
    >
      {children}
    </button>
  );
}

function ToolIcon({ tool }: { tool: PaletteTool }) {
  const p = { size: 16, strokeWidth: 1.5 } as const;
  if (tool.kind === "seat") return <Armchair {...p} />;
  if (tool.kind === "row") return <Rows3 {...p} />;
  if (tool.kind === "block") return <LayoutGrid {...p} />;
  if (tool.kind === "table") return tool.shape === "circle" ? <Square {...p} className="rounded-full" /> : <Sofa {...p} />;
  if (tool.kind === "ga") return <RectangleHorizontal {...p} />;
  if (tool.fixture === "bar") return <Wine {...p} />;
  if (tool.fixture === "door") return <DoorOpen {...p} />;
  if (tool.fixture === "text") return <TypeIcon {...p} />;
  return <RectangleHorizontal {...p} />;
}
