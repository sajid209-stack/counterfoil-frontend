"use client";

import { useTranslations } from "next-intl";
import { Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { SkeletonShape } from "./types";

/**
 * A page's loading state, drawn as the page's own shape.
 *
 * Polaris' SkeletonPage, Linear and Stripe all do the same thing: keep the
 * header, the filter row and the rows or cards where the real page puts them,
 * and swap only the content for quiet blocks. The page then arrives without
 * moving, which is the whole of the point — a generic spinner or a stack of
 * grey bars makes the page jump twice.
 *
 * Accessibility: the region is `role="status"` and `aria-busy`, carries ONE
 * visually-hidden "Loading…", and every block is `aria-hidden`. Motion is the
 * ordinary Skeleton pulse, which the global reduced-motion rule (both the OS
 * setting and Settings → Preferences) stills.
 *
 * Twelve shapes: seven for the admin (dashboard, list, cards, detail, form,
 * calendar, analytics) and five for the till (pos-wall, pos-board, pos-list,
 * pos-form, pos-scan).
 */
export function PageSkeleton({ shape, className }: { shape: SkeletonShape; className?: string }) {
  const t = useTranslations("screens");
  const Body = SHAPES[shape];
  return (
    <div role="status" aria-busy="true" data-skeleton={shape} className={cn("min-w-0", className)}>
      <span className="sr-only">{t("loading")}</span>
      <Body />
    </div>
  );
}

/* ───────────── primitives ───────────── */

/** Widths that vary row to row, so a block of rows does not read as a barcode. */
const VARY = ["72%", "58%", "84%", "66%", "78%", "52%", "90%", "62%"];
const vary = (i: number) => VARY[i % VARY.length];

/** The page's gutter, as the real pages wrap themselves in it. */
const Page = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-section px-gutter py-gutter", className)}>{children}</div>
);

/** A control on the page's paper: drawn white, as the real one is, with one quiet
 *  bar inside. A bare grey block on paper is barely there; a white one reads as
 *  "a field goes here", which is what the page will have. */
const Ctl = ({ className, bar = "55%", round, style }: { className?: string; bar?: string; round?: boolean; style?: React.CSSProperties }) => (
  <div aria-hidden style={style} className={cn("flex items-center bg-card px-comfortable shadow-sm", round ? "rounded-full" : "rounded-control", className)}>
    <Skeleton h={12} w={bar} />
  </div>
);

/** Search + a filter + the page's one action: the toolbar every list opens with. */
const Toolbar = ({ action = true }: { action?: boolean }) => (
  <div className="flex items-center gap-tight">
    <Ctl className="h-11 w-full max-w-xs flex-1 md:h-9" bar="40%" />
    <Ctl className="h-11 w-11 md:h-9 md:w-24" bar="60%" />
    {action && <Ctl className="ml-auto h-11 w-11 md:h-9 md:w-32" bar="60%" />}
  </div>
);

/** A label, a figure and a line: one headline number. */
const Figure = () => (
  <div className="flex flex-col gap-tight">
    <Skeleton h={12} w="40%" />
    <Skeleton h={28} w="62%" />
    <Skeleton h={12} w="30%" />
  </div>
);

/** Two-line row: a name over a meta line, and a figure at the end. */
const TwoLine = ({ i, lead }: { i: number; lead?: boolean }) => (
  <div className="flex items-center gap-comfortable px-card py-comfortable">
    {lead && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
    <div className="flex min-w-0 flex-1 flex-col gap-inline">
      <Skeleton h={14} w={vary(i)} />
      <Skeleton h={12} w="38%" />
    </div>
    <Skeleton h={14} w={64} className="shrink-0" />
  </div>
);

const Rows = ({ n, lead }: { n: number; lead?: boolean }) => (
  <div className="divide-y divide-hairline">
    {Array.from({ length: n }, (_, i) => (
      <TwoLine key={i} i={i} lead={lead} />
    ))}
  </div>
);

/* ───────────── admin shapes ───────────── */

function ListShape() {
  return (
    <Page>
      <Toolbar />
      <Card padding="none">
        {/* Column heads — a table from md, two-line rows below it. */}
        <div className="hidden grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr] gap-section border-b border-hairline px-card py-comfortable md:grid">
          {["30%", "40%", "34%", "28%", "36%"].map((w, i) => (
            <Skeleton key={i} h={12} w={w} />
          ))}
        </div>
        <div className="hidden divide-y divide-hairline md:block">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="grid min-h-12 grid-cols-[2fr_1.2fr_1fr_1fr_0.8fr] items-center gap-section px-card py-comfortable">
              <Skeleton h={14} w={vary(i)} />
              <Skeleton h={14} w={vary(i + 3)} />
              <Skeleton h={14} w="60%" />
              <Skeleton h={14} w="50%" />
              <Skeleton h={22} w={72} className="rounded-full" />
            </div>
          ))}
        </div>
        <div className="md:hidden">
          <Rows n={8} />
        </div>
        <div className="flex items-center justify-between gap-section border-t border-hairline px-card py-comfortable">
          <Skeleton h={12} w={96} />
          <div className="flex gap-tight">
            <Skeleton className="h-9 w-9 rounded-control" />
            <Skeleton className="h-9 w-9 rounded-control" />
          </div>
        </div>
      </Card>
    </Page>
  );
}

function DashboardShape() {
  return (
    <Page className="gap-major">
      {/* A phone states the four figures as one card of rows, as the dashboard does. */}
      <Card className="sm:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-section border-b border-hairline py-comfortable last:border-b-0">
            <Skeleton h={12} w={96} />
            <Skeleton h={20} w={88} />
          </div>
        ))}
      </Card>
      <div className="hidden gap-section sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <Figure />
          </Card>
        ))}
      </div>
      <div className="grid gap-section xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between pb-section">
            <Skeleton h={16} w={140} />
            <Skeleton h={28} w={120} className="rounded-control" />
          </div>
          {/* A chart's worth of height, so the card does not grow when it lands. */}
          <div className="flex h-48 items-end gap-tight">
            {[40, 62, 48, 74, 58, 86, 66, 92, 70, 54, 80, 64].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-inner" style={{ height: `${h}%` }} />
            ))}
          </div>
        </Card>
        <Card padding="none">
          <div className="px-card pt-card pb-tight">
            <Skeleton h={16} w={110} />
          </div>
          <Rows n={5} lead />
        </Card>
      </div>
      <Card padding="none">
        <div className="px-card pt-card pb-tight">
          <Skeleton h={16} w={130} />
        </div>
        <Rows n={5} />
      </Card>
    </Page>
  );
}

function CardsShape() {
  return (
    <Page>
      <Toolbar />
      <div className="grid grid-cols-1 gap-section sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} padding="none" className="overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col gap-tight p-card">
              <Skeleton h={16} w={vary(i)} />
              <Skeleton h={12} w="44%" />
              <div className="flex items-center justify-between pt-tight">
                <Skeleton h={16} w={64} />
                <Skeleton h={22} w={72} className="rounded-full" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

function DetailShape() {
  return (
    <Page>
      {/* The record's header row: a way back and the state, then its actions. */}
      <div className="flex flex-wrap items-center justify-between gap-tight">
        <div className="flex items-center gap-comfortable">
          <Skeleton h={14} w={72} />
          <Skeleton h={22} w={72} className="rounded-full" />
        </div>
        <div className="flex gap-tight">
          <Ctl className="h-11 w-28 md:h-9" />
          <Ctl className="h-11 w-11 md:h-9 md:w-28" />
        </div>
      </div>
      <div className="grid gap-section xl:grid-cols-3">
        <div className="flex flex-col gap-section xl:col-span-2">
          <Card>
            <div className="grid grid-cols-2 gap-x-section gap-y-major md:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="flex flex-col gap-tight">
                  <Skeleton h={12} w="46%" />
                  <Skeleton h={16} w={vary(i)} />
                </div>
              ))}
            </div>
          </Card>
          <Card padding="none">
            <div className="px-card pt-card pb-tight">
              <Skeleton h={16} w={120} />
            </div>
            <Rows n={4} />
          </Card>
        </div>
        <div className="flex flex-col gap-section">
          {[0, 1].map((k) => (
            <Card key={k}>
              <Skeleton h={16} w={96} className="mb-section" />
              <div className="flex flex-col gap-comfortable">
                <Skeleton h={14} w="84%" />
                <Skeleton h={14} w="62%" />
                <Skeleton h={14} w="72%" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Page>
  );
}

function FormShape() {
  return (
    <Page className="mx-auto w-full max-w-3xl gap-major">
      {[3, 2, 3].map((fields, s) => (
        <Card key={s} padding="none">
          <div className="flex flex-col gap-tight border-b border-hairline px-card py-section">
            <Skeleton h={16} w={150} />
            <Skeleton h={12} w="56%" />
          </div>
          <div className="divide-y divide-hairline">
            {Array.from({ length: fields }, (_, i) => (
              <div key={i} className="flex flex-col gap-tight px-card py-comfortable sm:flex-row sm:items-center sm:justify-between sm:gap-major">
                <div className="flex flex-col gap-inline sm:w-1/2">
                  <Skeleton h={14} w={vary(i + s)} />
                  <Skeleton h={12} w="70%" />
                </div>
                <Skeleton className="h-11 w-full rounded-control sm:w-56" />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </Page>
  );
}

function CalendarShape() {
  return (
    <Page>
      <div className="flex flex-wrap items-center gap-tight">
        <Ctl className="h-11 w-20 md:h-9" />
        <Ctl className="h-11 w-11 md:h-9 md:w-9" bar="100%" />
        <Ctl className="h-11 w-11 md:h-9 md:w-9" bar="100%" />
        <Skeleton h={16} w={150} />
        <Ctl className="ml-auto h-11 w-44 md:h-9" />
      </div>
      {/* Phone: a day strip over an agenda. From md: the week grid. */}
      <div className="flex flex-col gap-section md:hidden">
        <div className="grid grid-cols-7 gap-tight">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-control" />
          ))}
        </div>
        <Card padding="none">
          <Rows n={5} />
        </Card>
      </div>
      <Card padding="none" className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b border-hairline">
          <div />
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-inline px-tight py-comfortable">
              <Skeleton h={12} w={28} />
              <Skeleton h={18} w={24} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)]">
          {Array.from({ length: 8 }, (_, r) => (
            <div key={r} className="contents">
              <div className="flex h-14 justify-end border-b border-hairline pr-tight pt-inline">
                <Skeleton h={10} w={24} />
              </div>
              {Array.from({ length: 7 }, (_, c) => (
                <div key={c} className="relative h-14 border-b border-l border-hairline p-inline">
                  {(r * 7 + c) % 5 === 1 && <Skeleton className="h-full w-full rounded-inner" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </Page>
  );
}

function AnalyticsShape() {
  return (
    <Page className="gap-major">
      <div className="flex flex-wrap items-center gap-tight">
        <Ctl className="h-11 w-56 md:h-9" />
        <Ctl className="h-11 w-40 md:h-9" />
        <Ctl className="ml-auto h-11 w-11 md:h-9 md:w-28" />
      </div>
      <Card>
        <div className="grid grid-cols-2 gap-x-section gap-y-major md:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Figure key={i} />
          ))}
        </div>
      </Card>
      <Card>
        <Skeleton h={16} w={160} className="mb-section" />
        <Skeleton className="h-56 w-full" />
      </Card>
      <div className="grid gap-section lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, k) => (
          <Card key={k}>
            <Skeleton h={16} w={140} className="mb-section" />
            <div className="flex flex-col gap-comfortable">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex items-center gap-comfortable">
                  <Skeleton h={12} w={80} />
                  <Skeleton h={10} w={vary(i + k)} className="flex-1" style={{ maxWidth: vary(i + k) }} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Page>
  );
}

/* ───────────── till shapes ───────────── */

/** The till's page: a little tighter than the admin's, and 44px at every width. */
const GoPage = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex flex-col gap-section px-gutter py-section", className)}>{children}</div>
);

const Pills = ({ n }: { n: number }) => (
  <div className="flex flex-wrap gap-tight">
    {Array.from({ length: n }, (_, i) => (
      <Ctl key={i} round className="h-11" bar="60%" style={{ width: 72 + (i % 3) * 20 }} />
    ))}
  </div>
);

function PosWallShape() {
  return (
    <GoPage>
      <div className="flex items-center gap-tight">
        <Ctl round className="h-11 w-24 sm:w-36" />
        <Ctl round className="h-11 flex-1" bar="30%" />
      </div>
      <Pills n={4} />
      <div className="grid grid-cols-2 gap-tight sm:grid-cols-3 sm:gap-comfortable xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Card key={i} className="flex flex-col gap-tight">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton h={16} w={vary(i)} />
            <Skeleton h={24} w="46%" />
            <Skeleton h={12} w="62%" />
          </Card>
        ))}
      </div>
      {/* The dock: Cart on the left, the one forward button on the right. */}
      <Card className="flex items-center gap-tight">
        <Skeleton className="h-13 flex-1 rounded-full" />
        <Skeleton className="h-13 flex-1 rounded-full" />
      </Card>
    </GoPage>
  );
}

function PosBoardShape() {
  return (
    <GoPage>
      <div className="grid grid-cols-7 gap-tight">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-control" />
        ))}
      </div>
      <Pills n={4} />
      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-[3.5rem_repeat(4,1fr)] border-b border-hairline">
          <div />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex justify-center px-tight py-comfortable">
              <Skeleton h={14} w="60%" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(4,1fr)]">
          {Array.from({ length: 7 }, (_, r) => (
            <div key={r} className="contents">
              <div className="flex h-16 flex-col items-center justify-center gap-inline border-b border-hairline">
                <Skeleton h={16} w={16} />
                <Skeleton h={10} w={20} />
              </div>
              {Array.from({ length: 4 }, (_, c) => (
                <div key={c} className="h-16 border-b border-l border-hairline p-inline">
                  <Skeleton className={cn("h-full w-full rounded-inner", (r + c) % 3 === 0 ? "" : "opacity-40")} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </GoPage>
  );
}

function PosListShape() {
  return (
    <GoPage>
      <Ctl round className="h-12 w-full" bar="30%" />
      <Pills n={4} />
      <Card padding="none">
        <div className="divide-y divide-hairline">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-comfortable px-card py-comfortable">
              <div className="flex min-w-0 flex-1 flex-col gap-inline">
                <Skeleton h={16} w={vary(i)} />
                <Skeleton h={12} w="40%" />
              </div>
              <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    </GoPage>
  );
}

function PosFormShape() {
  return (
    <GoPage className="mx-auto w-full max-w-md items-stretch py-major">
      <div className="flex flex-col items-center gap-tight pb-section">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton h={22} w={180} />
        <Skeleton h={12} w={220} />
      </div>
      <Card className="flex flex-col gap-section">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-tight">
            <Skeleton h={12} w={90} />
            <Skeleton className="h-12 w-full rounded-control" />
          </div>
        ))}
        <Skeleton className="h-13 w-full rounded-full" />
      </Card>
    </GoPage>
  );
}

function PosScanShape() {
  return (
    <GoPage className="mx-auto w-full max-w-xl">
      {/* The camera's viewport: a block with the corners of a reticle. */}
      <div className="relative">
        <Skeleton className="aspect-4/3 w-full rounded-card" />
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-1/2 w-1/2 rounded-card border-2 border-dashed border-line" />
        </div>
      </div>
      <Ctl className="h-14 w-full" bar="40%" />
      <div className="flex flex-wrap justify-center gap-tight">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-11 w-28 rounded-full" />
        ))}
      </div>
    </GoPage>
  );
}

const SHAPES: Record<SkeletonShape, () => React.ReactElement> = {
  dashboard: DashboardShape,
  list: ListShape,
  cards: CardsShape,
  detail: DetailShape,
  form: FormShape,
  calendar: CalendarShape,
  analytics: AnalyticsShape,
  "pos-wall": PosWallShape,
  "pos-board": PosBoardShape,
  "pos-list": PosListShape,
  "pos-form": PosFormShape,
  "pos-scan": PosScanShape,
};
