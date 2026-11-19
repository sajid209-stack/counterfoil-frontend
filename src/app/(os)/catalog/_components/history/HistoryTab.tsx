"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Archive, EyeOff, Globe, Sparkles, UserRound, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { ActionMenu, Avatar, Button, Card, Notice, Select, Skeleton, StatusPill, type ActionMenuItem } from "@/components/ui";
import { canRevert, listCatalogHistory, type CatalogArea, type CatalogFieldChange, type CatalogRevision, type Product } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatClockOf, formatDate, formatDateTime, formatDay, formatDayRange } from "@/lib/format";
import { demoNow } from "@/lib/schedule";
import { useApiQuery } from "@/lib/useApi";
import { STATE_TONE, type TabId } from "../record/RecordFrame";
import { Change, lowerFirst, moneyDelta, useHistoryWords } from "./HistoryValues";
import { UndoDialog } from "./UndoDialog";
import {
  actorsOf,
  areasOf,
  buildSessions,
  dayOf,
  filterSessions,
  groupByDay,
  headlineOf,
  inStateSince,
  statsOf,
  type AreaFilter,
  type Session,
} from "./sessions";

const AREAS: AreaFilter[] = ["all", "status", "prices", "details", "rules", "where", "payment"];
/** Sessions shown before "Show older changes", and how many each press adds. */
const PAGE = 20;
/** The newest this many sessions open their diff on their own. */

/** The tab that edits each area. Payment choices read best next to the rules. */
const TAB_OF: Record<CatalogArea, TabId> = {
  status: "overview",
  details: "details",
  prices: "prices",
  rules: "rules",
  where: "where",
  payment: "rules",
};

const MARKER: Record<"on" | "off" | "archived" | "created", { Icon: LucideIcon; tone: string }> = {
  on: { Icon: Globe, tone: "bg-success-wash text-success" },
  off: { Icon: EyeOff, tone: "bg-subtle text-fg-secondary ring-1 ring-inset ring-line" },
  archived: { Icon: Archive, tone: "bg-subtle text-fg-secondary ring-1 ring-inset ring-line" },
  created: { Icon: Sparkles, tone: "bg-ember-wash text-brand-foreground" },
};

const stateOf = (status: string) => (status === "active" ? "onSale" : status === "archived" ? "archived" : "offSale") as "onSale" | "offSale" | "archived";

/**
 * The History tab (docs/catalog-history.md): what changed, who changed it, and
 * can I put it back. One save with N fields is one entry; a person's saves
 * within 15 minutes are one sitting showing its net change; going live and
 * archiving are milestones; Undo previews itself.
 */
export function HistoryTab({
  product,
  currency,
  onChanged,
  onOpenTab,
}: {
  product: Product;
  currency: string;
  onChanged: (next: Product) => void;
  onOpenTab: (tab: TabId) => void;
}) {
  const t = useTranslations("catalog.history");
  const tc = useTranslations("catalog");
  const ti = useTranslations("catalog.item");
  const { fieldLabel, text } = useHistoryWords(currency);

  const history = useApiQuery(() => listCatalogHistory(product), [product.id, product.updatedAt]);
  const now = useMemo(() => demoNow(), []);

  const [area, setArea] = useState<AreaFilter>("all");
  const [actorId, setActorId] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [undoing, setUndoing] = useState<Session | null>(null);

  const revisions: CatalogRevision[] = useMemo(() => history.data ?? [], [history.data]);
  const sessions = useMemo(() => buildSessions(revisions), [revisions]);
  const actors = useMemo(() => actorsOf(sessions), [sessions]);
  const filtered = useMemo(() => filterSessions(sessions, area, actorId), [sessions, area, actorId]);
  const stats = useMemo(() => statsOf(filtered), [filtered]);
  const shown = filtered.slice(0, limit);
  const days = useMemo(() => groupByDay(shown), [shown]);
  const created = sessions.find((s) => s.kind === "created") ?? null;
  const onlyCreation = sessions.every((s) => s.kind === "created");
  const filtering = area !== "all" || actorId !== "";
  const todayKey = dayOf(now.toISOString());
  const yesterdayKey = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString());

  /* The newest sessions with something to show open their diff on their own. */

  const full = (iso: string) => `${formatDayRange([dayOf(iso)], { year: true })}, ${formatClockOf(iso)}`;
  const ago = (iso: string): string => {
    const mins = Math.round((now.getTime() - Date.parse(iso)) / 60000);
    if (mins < 1) return t("ago.justNow");
    if (mins < 60) return t("ago.min", { count: mins });
    const hours = Math.round(mins / 60);
    if (hours < 24) return t("ago.hr", { count: hours });
    const d = Math.round(hours / 24);
    return d <= 7 ? t("ago.day", { count: d }) : formatDate(iso);
  };
  const dayLabel = (day: string) => {
    if (day === todayKey) return t("day.today");
    if (day === yesterdayKey) return t("day.yesterday");
    const year = Number(day.slice(0, 4));
    return `${formatDay(day, { weekday: true })}${year === now.getFullYear() ? "" : ` ${year}`}`;
  };

  const b = (c: ReactNode) => <b className="font-semibold">{c}</b>;
  const nameOf = (s: Session) => s.actor?.name ?? t("someone");

  /** The session, as a sentence in operator words. */
  const sentence = (s: Session): ReactNode => {
    const name = nameOf(s);
    const h = headlineOf(s);
    switch (h.type) {
      case "price":
        return t.rich("sentence.price", { name, ticket: h.change.subject?.name ?? "", from: text(h.change.before, h.change), to: text(h.change.after, h.change), b });
      case "rename":
        return t.rich("sentence.rename", { name, from: text(h.change.before, h.change), to: text(h.change.after, h.change), b });
      case "field":
        return t.rich("sentence.field", { name, field: lowerFirst(fieldLabel(h.change)), b });
      case "tierOn":
        return t.rich("sentence.tierOn", { name, ticket: h.change.subject?.name ?? "", b });
      case "tierOff":
        return t.rich("sentence.tierOff", { name, ticket: h.change.subject?.name ?? "", b });
      case "tierAdded":
        return t.rich("sentence.tierAdded", { name, ticket: h.change.subject?.name ?? "", b });
      case "tierRemoved":
        return t.rich("sentence.tierRemoved", { name, ticket: h.change.subject?.name ?? "", b });
      case "statusOn":
        return t.rich("sentence.statusOn", { name, b });
      case "statusOff":
        return t.rich("sentence.statusOff", { name, b });
      case "archived":
        return t.rich("sentence.archived", { name, b });
      case "several":
        return t.rich("sentence.several", { name, count: h.count, b });
      case "revert":
        return t.rich("sentence.revert", { name, when: formatDateTime(s.revertOf ?? s.at), b });
      case "netZero":
        return t.rich("sentence.netZero", { name, b });
    }
  };

  /** "Also renamed Foreigners and changed it back." */
  const zeroNote = (c: CatalogFieldChange): string => {
    const ticket = c.subject?.name ?? "";
    if (c.field === "tier.name") return t("netZero.rename", { ticket });
    if (c.field === "tier.price") return t("netZero.price", { ticket });
    if (c.subject) return t("netZero.tier", { ticket });
    return t("netZero.field", { field: lowerFirst(fieldLabel(c)) });
  };

  const menuFor = (s: Session): ActionMenuItem[] => {
    const items: ActionMenuItem[] = [];
    if (s.net.some(canRevert)) items.push({ key: "undo", label: t("menu.undo"), onSelect: () => setUndoing(s) });
    const first = [...s.net, ...s.zero][0];
    if (first) {
      const tab = TAB_OF[first.area];
      items.push({ key: "open", label: t("menu.open", { tab: ti(`tab.${tab}`) }), onSelect: () => onOpenTab(tab) });
    }
    return items;
  };

  const lastId = shown[shown.length - 1]?.id;

  // ── Pieces ───────────────────────────────────────────────────────────────

  const marker = (s: Session) => {
    const kind = s.kind === "created" ? "created" : s.kind === "milestone" ? (s.milestone ?? "off") : null;
    if (kind) {
      const { Icon, tone } = MARKER[kind];
      return (
        <span aria-hidden className={cn("relative grid h-7 w-7 shrink-0 place-items-center rounded-full", tone)}>
          <Icon size={14} strokeWidth={1.75} />
        </span>
      );
    }
    if (s.actor) return <span className="relative"><Avatar name={s.actor.name} size={28} soft /></span>;
    return (
      <span aria-hidden className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-subtle text-muted ring-1 ring-inset ring-line">
        <UserRound size={14} strokeWidth={1.75} />
      </span>
    );
  };

  /* Sentences that already carry the values ("from ৳9,600 to ৳8,000", "renamed
     A to B", "published it"): a diff under them would only repeat them. */
  const SELF_DESCRIBING = new Set(["price", "rename", "tierOn", "tierOff", "tierAdded", "tierRemoved", "statusOn", "statusOff", "archived", "netZero"]);
  /** Diffs longer than this show their first rows and a "Show N more". */
  const DIFF_ROWS = 4;

  const item = (s: Session) => {
    const hid = `hist-${s.id}`;
    const isCreated = s.kind === "created";
    const headline = isCreated ? null : headlineOf(s);
    const showDiff = !!headline && !SELF_DESCRIBING.has(headline.type) && s.net.length > 0;
    const allRows = open[s.id] ?? false;
    const rows = showDiff ? (allRows || s.net.length <= DIFF_ROWS ? s.net : s.net.slice(0, DIFF_ROWS - 1)) : [];
    const areas = isCreated ? [] : areasOf(s);
    const quiet = headline?.type === "netZero";
    const menu = isCreated ? [] : menuFor(s);
    const statusChange = s.kind === "milestone" ? s.net.find((c) => c.field === "status") : undefined;
    const milestoneState = statusChange ? stateOf(statusChange.after?.type === "status" ? statusChange.after.value : "inactive") : null;
    const priceDelta = headline?.type === "price" ? moneyDelta(headline.change, currency) : null;
    const dot = <span aria-hidden className="px-1.5">·</span>;

    return (
      <li key={s.id} className="relative flex gap-tight pb-comfortable last:pb-0">
        {s.id !== lastId && <span aria-hidden className="absolute bottom-0 left-3.5 top-7 w-px bg-line" />}
        {marker(s)}
        <article aria-labelledby={hid} className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Line 1: the sentence (a status change carries its pill inline), and
              the actions at the end of the same line. */}
          <header className="flex min-w-0 items-start gap-tight">
            <h4 id={hid} className={cn("min-w-0 flex-1 break-words pt-1 text-sm font-normal leading-snug", quiet ? "text-muted" : "text-fg")}>
              {isCreated ? (s.actor ? t.rich("created.by", { name: s.actor.name, b }) : t("created.title")) : sentence(s)}
              {milestoneState && (
                <span className="ml-tight inline-flex align-middle">
                  <StatusPill tone={STATE_TONE[milestoneState]} shape={milestoneState === "onSale" ? "transaction" : "record"}>
                    {tc(`state.${milestoneState}`)}
                  </StatusPill>
                </span>
              )}
            </h4>
            {menu.length > 0 && (
              <span className="-my-1.5 shrink-0">
                <ActionMenu label={t("menu.label")} items={menu} />
              </span>
            )}
          </header>

          {/* Line 2: when, what part, and anything the sentence leaves out. */}
          <p className="flex flex-wrap items-center text-xs leading-relaxed text-muted">
            <time dateTime={s.at} title={full(s.at)}>{isCreated ? full(s.at) : formatClockOf(s.at)}</time>
            {areas.length > 0 && !milestoneState && <>{dot}<span>{areas.map((x) => t(`tag.${x}`)).join(", ")}</span></>}
            {priceDelta && <>{dot}<span className="font-medium text-fg-secondary">{priceDelta}</span></>}
            {isCreated && !s.actor && <>{dot}<span>{t("created.untrackedShort")}</span></>}
          </p>

          {/* A summary sentence ("made 3 changes") gets its rows, inline:
              label and before → after, as wide as they need and no wider. */}
          {showDiff && (
            <dl aria-label={t("diff.list")} className="mt-tight grid w-fit max-w-full grid-cols-1 gap-y-1.5 border-l border-line pl-comfortable sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-section">
              {rows.map((c) => (
                <div key={`${c.field}|${c.subject?.id ?? ""}`} className="contents">
                  <dt className="min-w-0 break-words text-sm text-muted">{fieldLabel(c)}</dt>
                  <dd className="min-w-0 pb-1 sm:pb-0">
                    <Change c={c} currency={currency} />
                  </dd>
                </div>
              ))}
              {rows.length < s.net.length && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [s.id]: true }))}
                  className="-my-tight self-start py-tight text-left text-sm font-medium text-brand-foreground hover:underline sm:col-span-2"
                >
                  {t("diff.more", { count: s.net.length - rows.length })}
                </button>
              )}
            </dl>
          )}

          {s.zero.length > 0 && (
            <ul className="text-xs text-muted">
              {s.zero.map((z) => (
                <li key={`${z.field}|${z.subject?.id ?? ""}`}>{zeroNote(z)}</li>
              ))}
            </ul>
          )}
        </article>
      </li>
    );
  };

  // ── States ───────────────────────────────────────────────────────────────

  if (history.loading && !history.data) {
    return (
      <div role="status" aria-busy="true" aria-label={t("loading")} className="flex flex-col gap-section">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-comfortable">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-tight">
              <Skeleton h={16} className="w-3/4 max-w-md" />
              <Skeleton h={12} className="w-1/3 max-w-40" />
              <Skeleton h={72} className="w-full rounded-inner" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (history.error && !history.data) {
    return (
      <Notice tone="danger" title={t("error.title")} action={{ label: t("error.retry"), onClick: history.reload }}>
        {history.error.message}
      </Notice>
    );
  }

  const personName = actors.find((a) => a.id === actorId)?.name ?? "";
  const emptyText =
    area !== "all" && actorId ? t("empty.both", { area: t(`area.${area}`), name: personName })
    : area !== "all" ? t("empty.area", { area: t(`area.${area}`) })
    : t("empty.person", { name: personName });

  const summaryLine = stats.changes === 0 || !stats.last ? t("summary.none") : t("summary.text", { changes: stats.changes, people: stats.people.length, when: ago(stats.last.at) });
  const since = inStateSince(sessions, product.status);
  const state = stateOf(product.status);

  return (
    <div className="grid gap-section md:grid-cols-[minmax(0,46rem)_17.5rem] md:items-start">
      <div className="flex min-w-0 flex-col gap-section">
        <h2 className="sr-only">{t("title")}</h2>

        {/* One toolbar row of two dropdowns (what, who), GitHub audit-log style.
            Not a second tab bar: under the record's own tabs a row of area
            tabs read as nested navigation, and the kit keeps tabs for pages. */}
        <div className="flex flex-col gap-tight">
          <p className="text-sm text-muted md:hidden">{summaryLine}</p>
          <div className="grid grid-cols-2 gap-tight sm:flex sm:items-center">
            <div className="min-w-0 sm:w-60">
              <Select
                aria-label={t("filter.area")}
                value={area}
                onChange={(v) => setArea(v as AreaFilter)}
                options={AREAS.map((a) => {
                  const n = a === "all" ? sessions.length : filterSessions(sessions, a, "").length;
                  return { value: a, label: t(`area.${a}`), trail: String(n), disabled: a !== "all" && n === 0 };
                })}
              />
            </div>
            {actors.length > 0 && (
              <div className="min-w-0 sm:w-56">
                <Select
                  aria-label={t("filter.person")}
                  value={actorId || "all"}
                  onChange={(v) => setActorId(v === "all" ? "" : v)}
                  options={[
                    { value: "all", label: t("filter.everyone") },
                    ...actors.map((a) => ({ value: a.id, label: a.name, lead: <Avatar name={a.name} size={24} soft /> })),
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {filtered.length === 0 && filtering ? (
          <div className="flex flex-col items-start gap-tight py-section">
            <p className="text-base text-fg">{emptyText}</p>
            <Button
              variant="link"
              onClick={() => {
                setArea("all");
                setActorId("");
              }}
            >
              {t("empty.showAll")}
            </Button>
          </div>
        ) : (
          <Card className="flex flex-col">
            {onlyCreation && <p className="pb-section text-sm text-muted">{t("empty.only")}</p>}
            {days.map(({ day, sessions: items }) => (
              <section key={day} aria-labelledby={`hist-day-${day}`} className="flex flex-col pb-section last:pb-0">
                <h3
                  id={`hist-day-${day}`}
                  className="sticky top-[var(--os-phone-bar)] z-10 bg-card pb-tight text-xs font-semibold text-muted md:top-0"
                >
                  {dayLabel(day)}
                </h3>
                <ol className="flex flex-col">{items.map(item)}</ol>
              </section>
            ))}
            {filtered.length > limit && (
              <div className="flex justify-center pt-tight">
                <Button variant="secondary" onClick={() => setLimit((n) => n + PAGE)}>
                  {t("older")}
                </Button>
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="hidden md:sticky md:top-section md:block">
        <Card as="aside" title={t("rail.title")} headingLevel={3}>
          <div className="flex flex-col gap-comfortable text-sm">
            {created && (
              <div className="flex flex-col">
                <span className="text-fg">{t("rail.created", { date: formatDayRange([dayOf(created.at)], { year: true }) })}</span>
                <span className="text-muted">{created.actor ? t("rail.by", { name: created.actor.name }) : t("rail.untracked")}</span>
              </div>
            )}
            {stats.last && (
              <div className="flex flex-col">
                <span className="text-fg">{t("rail.last", { when: ago(stats.last.at) })}</span>
                <span className="text-muted">{stats.last.actor ? t("rail.by", { name: stats.last.actor.name }) : t("someone")}</span>
              </div>
            )}
            <div className="flex flex-col gap-tight">
              <span className="text-fg">{t("rail.counts", { changes: stats.changes, people: stats.people.length })}</span>
              {stats.people.length > 0 && (
                <ul className="flex items-center">
                  {stats.people.map((p, i) => (
                    <li key={p.id} title={p.name} className={cn("rounded-full ring-2 ring-card", i > 0 && "-ml-inline")}>
                      <Avatar name={p.name} size={28} soft />
                      <span className="sr-only">{p.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {since && <span className="text-fg">{t("rail.since", { state: tc(`state.${state}`), date: formatDay(dayOf(since)) })}</span>}
          </div>
        </Card>
      </div>

      {undoing && (
        <UndoDialog
          session={undoing}
          revisions={revisions}
          product={product}
          currency={currency}
          onClose={() => setUndoing(null)}
          onDone={(next) => {
            history.reload();
            onChanged(next);
          }}
        />
      )}
    </div>
  );
}
