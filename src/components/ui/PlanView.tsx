"use client";

/**
 * A floor plan, drawn.
 *
 * ONE renderer, used by the designer in OS and by the seat picker at the till.
 * Before this there were two: the designer laid seats on a CSS grid and printed
 * its own "SCREEN" banner, and the till did the same independently — so a room
 * with a bar, or a stage at the side, or anything that is not a rectangle of
 * squares, could not be shown truthfully on either. A plan an operator draws
 * and a plan a customer is offered must be the same picture, which is only
 * guaranteed if it is the same component.
 *
 * It is presentational. The designer overlays its own selection handles on top
 * using the same scale, so interaction lives in the editor and geometry lives
 * in `lib/layout`.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { fitScale, planExtent, type Extent } from "@/lib/layout";
import type { LayoutFixture, LayoutSeat, SeatShape } from "@/lib/api";

/** The least a caller must supply per element. Both `LayoutSeat` and the till's
 *  `AvailableSeat` satisfy it, which is why neither has to be converted. */
export interface PlanElement {
  id: string;
  name: string;
  kind?: "seat" | "table" | "ga";
  posX: number;
  posY: number;
  width?: number;
  height?: number;
  shape?: SeatShape;
  rotation?: number;
  capacity?: number;
  /** The category's colour, or null for something not yet for sale. */
  color?: string | null;
}

/** How an element reads. `idle` is the designer's "not for sale yet". */
export type PlanElementState = "available" | "selected" | "taken" | "idle";

export interface PlanViewProps {
  elements: PlanElement[];
  fixtures?: LayoutFixture[];
  stateOf?: (el: PlanElement) => PlanElementState;
  /**
   * Given, every element becomes a real button — which is what makes the plan
   * keyboard-reachable and gives every seat an accessible name, the thing a
   * canvas most often gets wrong.
   *
   * The event comes with it because an editor needs to tell a keyboard
   * activation from a mouse click: `detail === 0` is a click the browser
   * synthesised from Enter or Space, and an editor that drives selection from
   * `pointerdown` must ignore the mouse one or a shift-click collapses to a
   * single selection.
   */
  onPick?: (el: PlanElement, e: React.MouseEvent) => void;
  /** An editor's drag: it owns the gesture, and needs the modifier keys. */
  onElementPointerDown?: (el: PlanElement, e: React.PointerEvent) => void;
  /** An accessible name per element; falls back to its own label. */
  labelOf?: (el: PlanElement) => string;
  /** Fixed px-per-unit. Omitted, the plan scales to fit its box. */
  scale?: number;
  /**
   * The working area, in units. Omitted, it shrink-wraps the plan — right for
   * a picker. An editor MUST pass its own: an extent derived from what is being
   * dragged changes as it moves, so the whole plan shifts under the pointer.
   */
  extent?: Extent;
  /** Extra px-per-unit ceiling when auto-fitting. */
  maxScale?: number;
  /** Drawn behind everything, so an editor can put its grid there. */
  underlay?: (ctx: { scale: number; extent: Extent }) => React.ReactNode;
  /** Drawn over everything at the same scale — the editor's handles. */
  overlay?: (ctx: { scale: number; extent: Extent }) => React.ReactNode;
  className?: string;
  /** Height of the drawing box. The plan is centred in it. */
  minHeight?: number;
  dataAttr?: string;
}

const w = (e: PlanElement) => e.width ?? 1;
const h = (e: PlanElement) => e.height ?? 1;

export function PlanView({
  elements,
  fixtures = [],
  stateOf,
  onPick,
  onElementPointerDown,
  labelOf,
  scale: fixedScale,
  extent: fixedExtent,
  maxScale = 34,
  underlay,
  overlay,
  className,
  minHeight = 260,
  dataAttr,
}: PlanViewProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);

  /* Measure the column rather than scaling a fixed viewBox: the chart work
     recorded what the alternative costs — a 10px label rendered at 5px on a
     phone. The svg-free version of the same rule. */
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const extent = fixedExtent ?? planExtent([...elements, ...fixtures]);
  const scale = fixedScale ?? (boxW ? fitScale(extent, boxW, minHeight, maxScale) : maxScale);
  const px = (u: number) => u * scale;

  return (
    <div
      ref={box}
      data-plan={dataAttr ?? "plan"}
      className={cn("relative w-full overflow-auto", className)}
      style={{ minHeight }}
    >
      {/* The plan's own surface, and the origin every element is positioned
          against. An editor converting a pointer to units MUST measure this and
          not the scroll box around it: the surface is centred when it is
          narrower than its column, and it moves when the box is scrolled. */}
      <div
        data-plan-surface=""
        className="relative mx-auto"
        style={{ width: px(extent.width), height: px(extent.height) }}
      >
        {underlay?.({ scale, extent })}

        {/* Scenery first: it is the ground the seats sit on. */}
        {fixtures.map((f) => (
          <FixtureView key={f.id} fixture={f} extent={extent} scale={scale} />
        ))}

        {elements.map((el) => {
          const state = stateOf?.(el) ?? (el.color ? "available" : "idle");
          const style: React.CSSProperties = {
            left: px(el.posX - extent.minX),
            top: px(el.posY - extent.minY),
            width: px(w(el)),
            height: px(h(el)),
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          };
          const name = labelOf?.(el) ?? el.name;
          const interactive = !!onPick || !!onElementPointerDown;
          return interactive ? (
            <button
              key={el.id}
              type="button"
              data-plan-el={el.id}
              aria-label={name}
              title={name}
              aria-pressed={state === "selected"}
              onPointerDown={onElementPointerDown ? (e) => onElementPointerDown(el, e) : undefined}
              onClick={onPick ? (e) => onPick(el, e) : undefined}
              className="absolute"
              style={style}
            >
              <ElementFace el={el} state={state} scale={scale} />
            </button>
          ) : (
            <div key={el.id} data-plan-el={el.id} role="img" aria-label={name} className="absolute" style={style}>
              <ElementFace el={el} state={state} scale={scale} />
            </div>
          );
        })}

        {overlay?.({ scale, extent })}
      </div>
    </div>
  );
}

/* ── The face of a thing ─────────────────────────────────────────────────── */

const radiusFor = (shape: SeatShape | undefined, scale: number) =>
  shape === "circle" ? "9999px" : shape === "rounded" ? `${Math.max(3, scale * 0.22)}px` : "3px";

function ElementFace({ el, state, scale }: { el: PlanElement; state: PlanElementState; scale: number }) {
  const kind = el.kind ?? "seat";
  const color = el.color ?? null;
  const ga = kind === "ga";
  /* Room for a label is a measurement, not a guess: below this the glyph would
     be under the 12px floor, so the element carries its name in its accessible
     name only. A cramped digit says less than a clean square. */
  const showLabel = scale * Math.min(w(el), h(el)) >= 18;

  const selected = state === "selected";
  const taken = state === "taken";
  const idle = state === "idle";

  /* The category is carried by the FILL and the border; the label is read in
     the theme's own ink. An operator picks these colours by hand, so drawing
     small text in one cannot be guaranteed readable — a blue category measured
     2.79:1 on a dark card. It is the rule the calendar settled on: the hue is
     a ground, never a letterform. White on a selected element is the declared
     white-on-ember exception, at display weight against a solid fill. */
  const style: React.CSSProperties = {
    borderRadius: radiusFor(el.shape, scale),
    ...(idle || taken
      ? {}
      : color
        ? { background: selected ? color : `${color}2e`, borderColor: color, color: selected ? "#fff" : undefined }
        : {}),
  };

  return (
    <span
      className={cn(
        "flex h-full w-full items-center justify-center overflow-hidden border text-center font-medium leading-none",
        ga && "border-dashed",
        idle && "border-dashed border-line bg-transparent text-muted",
        taken && "border-line bg-line text-muted line-through",
        selected && "border-transparent",
      )}
      style={style}
    >
      {showLabel && (
        <span className="truncate px-[1px]" style={{ fontSize: Math.min(13, Math.max(8, scale * 0.42)) }}>
          {kind === "seat" ? el.name.replace(/^[A-Z]+/, "") || el.name : el.name}
          {ga && el.capacity ? ` · ${el.capacity}` : ""}
        </span>
      )}
    </span>
  );
}

/* ── Scenery ─────────────────────────────────────────────────────────────── */

function FixtureView({ fixture: f, extent, scale }: { fixture: LayoutFixture; extent: Extent; scale: number }) {
  const px = (u: number) => u * scale;
  const style: React.CSSProperties = {
    left: px(f.posX - extent.minX),
    top: px(f.posY - extent.minY),
    width: px(f.width),
    height: px(f.height),
    transform: f.rotation ? `rotate(${f.rotation}deg)` : undefined,
  };
  const fontSize = Math.min(13, Math.max(9, scale * 0.38));

  /* Scenery is drawn in the neutral tokens, never in the accent: the brand
     colour on this screen belongs to what is for sale. */
  const common = "absolute flex items-center justify-center overflow-hidden text-center leading-none";

  if (f.kind === "wall") {
    return <div data-fixture={f.kind} className="absolute rounded-full bg-strong/70" style={style} aria-hidden />;
  }
  if (f.kind === "text") {
    return (
      <div data-fixture={f.kind} className={cn(common, "font-medium uppercase tracking-widest text-muted")} style={{ ...style, fontSize }}>
        <span className="truncate">{f.label}</span>
      </div>
    );
  }
  if (f.kind === "door") {
    return (
      <div data-fixture={f.kind} className={cn(common, "flex-col gap-[2px]")} style={style}>
        <span className="h-[2px] w-full rounded-full bg-strong/60" />
        <span className="truncate text-muted" style={{ fontSize: Math.max(9, fontSize - 1) }}>{f.label}</span>
      </div>
    );
  }
  // screen · stage · bar — a solid plate that names itself
  return (
    <div
      data-fixture={f.kind}
      className={cn(
        common,
        "border border-line bg-subtle font-medium uppercase tracking-widest text-muted",
        f.kind === "screen" ? "rounded-full" : "rounded-sm",
      )}
      style={{ ...style, fontSize }}
    >
      <span className="truncate px-1">{f.label}</span>
    </div>
  );
}

/** A plan's elements, as the designer holds them. */
export const seatToElement = (s: LayoutSeat, color: string | null): PlanElement => ({
  id: s.id,
  name: s.name,
  kind: s.kind ?? "seat",
  posX: s.posX,
  posY: s.posY,
  width: s.width,
  height: s.height,
  shape: s.shape,
  rotation: s.rotation,
  capacity: s.capacity,
  color,
});
