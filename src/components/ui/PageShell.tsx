"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, ChevronLeft, MoreHorizontal, Plus } from "lucide-react";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { cn } from "@/lib/cn";
import { useBarTitle } from "@/lib/barTitle";
import { Button, type ButtonProps } from "./Button";

/**
 * A page's one create action.
 *
 * Separate from `actions` because the two want different room. On a phone it
 * moves up beside the large title as a 40px round icon button in the header's
 * pill (docs/mobile.md section 8, rule 5) — icon only, the words are its
 * accessible name and its tooltip. The page's other `actions` go behind a round
 * "⋯" beside it (`PhoneActions`), which is Shopify admin mobile's header
 * exactly: the one thing you came to do, and the rest one tap away.
 *
 * A page declares it rather than PageShell guessing which of its buttons is
 * the important one.
 *
 * On a desktop it is drawn by the page, in its first toolbar (`PageToolbar`),
 * or in a record page's header row — never in a row of its own.
 */
export interface PagePrimary {
  label: string;
  /** No longer drawn: the phone's button is icon-only and named by `label`.
   *  Kept so existing callers still type-check. */
  shortLabel?: string;
  /** Defaults to a plus, which is what every one of these is. */
  icon?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  /** Passed through to the desktop button — a keyboard shortcut hint. */
  title?: string;
  keyShortcut?: string;
}

// Standard page frame for OS screens: title, optional description, and — on a
// record page only — a header row with a way back and the record's state.
//
// On desktop the title is PORTALLED into the sticky glass bar
// (#os-page-header, rendered by OsShell) rather than drawn under it. The Aura
// reference puts the page title inside its sticky header, and Counterfoil was
// spending 183px on a 56px bar whose left 737px were empty plus a separate
// header beneath it. Same content, one bar.
//
// Below md the bar is a logo strip with no room for a three-line header, so
// the title renders inline there instead. Both branches render the SAME JSX
// from the same props — the header has one definition, shown in one of two
// places depending on how much room the viewport has.
/** A store that never changes: subscribing to it is a no-op. */
const noSubscribe = () => () => {};

/**
 * Is the phone bar's back slot there to be used?
 *
 * One rule for every record page on a phone (Shopify admin mobile's): a page
 * that has a way back shows it as an arrow at the left of the top bar, to that
 * same href, and does NOT draw it again in the page. From md the bar has no
 * arrow and the page draws its own link. A page rendered outside the OS shell
 * has no bar, so its link stays in the page.
 */
export function useBackInBar(): boolean {
  const wide = useMediaQuery(MD);
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-back-mobile"), () => null);
  return !wide && !!slot;
}

/**
 * The phone's back button, portalled into the slots OsShell's PhoneBar leaves for
 * it: a 40px round button left of the record's title in the large header, and the
 * plain one in the compact bar that fades in once the header has scrolled away.
 * While the first is there the header's own settings chevron steps aside.
 */
export function BarBack({ href, label }: { href: string; label: string }) {
  const t = useTranslations("nav");
  const wide = useMediaQuery(MD);
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-back-mobile"), () => null);
  const compact = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-back-compact"), () => null);
  if (wide || !slot) return null;
  const name = t("backTo", { label });
  return (
    <>
      {createPortal(
        <Link
          href={href}
          aria-label={name}
          data-bar-back
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-line bg-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] hover:bg-muted-wash active:bg-secondary-hover"
        >
          <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
        </Link>,
        slot,
      )}
      {compact &&
        createPortal(
          <Link
            href={href}
            aria-label={name}
            className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] hover:bg-muted-wash active:bg-secondary-hover"
          >
            <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
          </Link>,
          compact,
        )}
    </>
  );
}

/**
 * The desktop create button, for a page to place in its own toolbar.
 *
 * Mercury, Stripe, Linear, Notion and Shopify admin all keep a list's create
 * button on the toolbar of the list — the row with its tabs, search and
 * filters — because that row already exists and a row of its own to hold one
 * or two buttons spends ~70px of every list on nothing. Nothing here on a
 * phone: there it is the bar's plus, which `PageShell` portals.
 */
export function PagePrimaryButton({ primary, size = "sm" }: { primary: PagePrimary; size?: "sm" | "md" }) {
  const wide = useMediaQuery(MD);
  const router = useRouter();
  if (!wide) return null;
  return (
    <Button
      size={size}
      icon={primary.icon ?? <Plus size={16} strokeWidth={1.75} />}
      /* `Button` is a <button>; an anchor inside one is invalid markup, so a
         destination is pushed. The phone's copy IS a Link, where a long-press
         to open in a new tab is a thing people do. */
      onClick={primary.onClick ?? (primary.href ? () => router.push(primary.href!) : undefined)}
      disabled={primary.disabled}
      title={primary.title}
      aria-keyshortcuts={primary.keyShortcut}
    >
      {primary.label}
    </Button>
  );
}

/**
 * A secondary page action that gives up its words on a phone.
 *
 * In a toolbar that also holds a search box and a filter button there is no
 * room for a labelled button at 390px — nor at 768 to 1023, where the rail
 * takes 240px and the content is under 800 — and a row of its own would put
 * the wasted line straight back. The label stays as the button's name and its
 * tooltip; from lg it is drawn.
 */
export function PageAction({ label, icon, variant = "secondary", className, ...rest }: Omit<ButtonProps, "children" | "size"> & { label: string }) {
  return (
    <Button size="sm" variant={variant} icon={icon} title={label} className={cn("max-md:w-11 max-md:px-0 md:max-lg:w-9 md:max-lg:px-0", className)} {...rest}>
      <span className="max-lg:sr-only">{label}</span>
    </Button>
  );
}

/**
 * The first toolbar of a page: what it filters on the left (tabs, search,
 * filters), what it does on the right (its create button and any secondary
 * actions).
 *
 * This is where page-level actions live. `PageShell` draws no header row of
 * its own on a list or a dashboard — only a record page (a way back, a state)
 * has one — so a page's buttons ride on the row it already has.
 *
 * `underline` is for a tab strip: the strip's own rule continues under the
 * buttons so the row reads as one bar, not tabs with buttons floating beside.
 */
export function PageToolbar({
  children,
  actions,
  primary,
  underline = false,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  primary?: PagePrimary;
  underline?: boolean;
  className?: string;
}) {
  const wide = useMediaQuery(MD);
  const hasEnd = !!actions || (wide && !!primary);
  return (
    /* A tab strip stays on one row (it scrolls). A filter row wraps: with the
       rail beside it a tablet has under 500px, and a 256px search box plus a
       create button does not fit — so the actions drop under it, at the right,
       rather than the box running over them. */
    <div className={cn("flex", underline ? "items-stretch" : "flex-wrap items-start gap-tight", className)}>
      <div className={cn("min-w-0 flex-1", !underline && "basis-0 md:basis-[22rem]")}>{children}</div>
      {hasEnd && (
        <div className={cn("flex shrink-0 items-center gap-tight", underline ? "border-b border-line pb-px pl-section" : "ml-auto")}>
          {actions}
          {primary && <PagePrimaryButton primary={primary} />}
        </div>
      )}
    </div>
  );
}

/**
 * A page's secondary actions on a phone: a round "⋯" in the header's action pill
 * that opens them in a small panel under it.
 *
 * `actions` is a ReactNode — a Save button, a Print button, an `ActionMenu` —
 * not a list of menu items, so it cannot be re-skinned as one. It is rendered
 * as it came, in a panel the bar's button opens, and the panel is deliberately
 * NOT a clipping scroller: an `ActionMenu` inside it opens its own absolutely
 * positioned list, and a sheet with `overflow` would cut that in half.
 *
 * The panel closes behind any press of a button or link inside it, except the
 * ones that open something of their own (`aria-haspopup`): the action has
 * already run by the time the click reaches here, and its dialog lives in the
 * page, not in this panel. Escape and a tap outside close it too.
 */
function PhoneActions({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      btn.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("pageActions")}
        aria-haspopup="true"
        aria-expanded={open}
        data-page-actions-toggle
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-card text-fg transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] hover:bg-muted-wash active:bg-secondary-hover",
          open && "bg-muted-wash",
        )}
      >
        <MoreHorizontal size={20} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          role="group"
          aria-label={t("pageActions")}
          data-page-actions
          onClick={(e) => {
            const hit = (e.target as HTMLElement).closest("button, a");
            if (hit && !hit.hasAttribute("aria-haspopup")) setOpen(false);
          }}
          className="absolute -right-1 top-[calc(100%+4px)] z-50 flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-end gap-tight rounded-md border border-line bg-card p-comfortable shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function PageShell({
  title,
  description,
  actions,
  primary,
  back,
  status,
  subtitle,
  scope,
  children,
}: {
  title: string;
  description?: string;
  /**
   * Phone only: one quiet line under the (stood-down) heading, such as a date.
   * Pages that do not pass it draw nothing new. From `sm` it is not drawn.
   */
  subtitle?: React.ReactNode;
  /** Phone only: a small control, usually a `PeriodPill`, right-aligned on the subtitle's line. */
  scope?: React.ReactNode;
  /**
   * The record's own buttons (Save, Print, ⋯) — drawn on the header row of a
   * record page, the right-hand side of `back` and `status`.
   *
   * A list or dashboard does not use this: it puts its buttons in its own
   * toolbar (`PageToolbar`). A page that still passes `actions` without a
   * `back` or `status` keeps a row so nothing disappears while it is moved,
   * but that row is exactly the empty strip under the bar this frame exists to
   * avoid.
   */
  actions?: React.ReactNode;
  primary?: PagePrimary;
  /** A way back to the list this page belongs to. Left of the header row. */
  back?: { href: string; label: string };
  /** The record's state (an order's pill). Beside the back link, left of the header row. */
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Resolved after mount: the slot lives in OsShell, above this in the tree,
  // so it exists by the time effects run. Null on the first paint and on any
  // page that renders a PageShell outside the OS shell — which is why the
  // mobile copy is the unconditional one and this is the enhancement.

  // Gated on the media query, not just on the slot existing. The desktop bar
  // is display:none below md but still IN the DOM, so portalling whenever the
  // slot resolves rendered a second, invisible copy of every control on a
  // phone — harmless to look at (display:none is out of the a11y tree too) but
  // it is a real duplicate node, and it is the FIRST one in document order, so
  // anything selecting "the location select" got the hidden one. Matching the
  // md breakpoint means exactly one copy exists at any width.
  // Server snapshot false: assume narrow, so the header ships in the document.
  const wide = useMediaQuery(MD);
  const router = useRouter();
  /* The phone's bar names the page; this heading repeats it unless the page
     is a sub-page the bar only knows the section of. */
  const barTitle = useBarTitle();
  const echoesBar = !!barTitle && barTitle.trim() === title.trim();
  // The slots are read the same way, and for the same reason: they are DOM
  // rendered by OsShell above this in the tree, they exist for the life of the
  // shell, and they never change identity — so subscribe is a no-op and the
  // snapshot is just the node. getElementById returns the same object on every
  // call, which is what keeps the snapshot stable enough for the hook.
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-header"), () => null);
  /* A phone's page actions (the orange create button, the "⋯") sit in the page's
     own first toolbar row, at its right (docs/mobile.md section 8, v8): a page
     marks the spot with <PhoneActionsSlot /> (FilterBar does it for every list).
     The slot hands its node back through a ref callback; without one, the
     actions take a right-aligned row of their own above the content. */
  const [inlineSlot, setInlineSlot] = useState<HTMLElement | null>(null);
  /* A record's own title takes the phone header's title place (22/700 beside the
     back button) and the compact bar's; the page's <h1> then stands down to a
     screen-reader-only heading, so the name is read once. */
  const titleSlot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-title-mobile"), () => null);
  const titleCompact = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-title-compact"), () => null);

  /* A phone does not have room for a page's buttons beside its title, so they
     go behind the bar's round "⋯" — but only when there IS a bar to put it in:
     a PageShell rendered outside the OS shell keeps them in the page. */
  const phoneOverflow = !wide && !!actions;
  const backInBar = useBackInBar();
  const recordTitle = !!back && backInBar && !!titleSlot;
  /* A header row exists for a RECORD: a way back, a state. A list or a
     dashboard has no row — its buttons are in its toolbar. (`actions` alone
     still draws one, for pages not yet moved; see the prop's note.) On a phone
     the row keeps only the way back and the state; the actions are in the bar. */
  const hasRow = !!((back && !backInBar) || status || (actions && !phoneOverflow));
  const icon = primary?.icon ?? <Plus size={16} strokeWidth={1.75} />;
  /* Desktop, on a record page: the words, because there is room for them and a
     labelled button is always the better one. A list's own copy is
     `PagePrimaryButton`, in its toolbar. */
  const widePrimary = primary && (back || status) && (
    <Button
      icon={icon}
      onClick={primary.onClick ?? (primary.href ? () => router.push(primary.href!) : undefined)}
      disabled={primary.disabled}
      title={primary.title}
      aria-keyshortcuts={primary.keyShortcut}
    >
      {primary.label}
    </Button>
  );
  /* Phone: the action beside the title — the same orange primary the desktop
     header carries, as a 40px icon button (a 44px target) with the page's one
     corner; the words are its accessible name and its tooltip. */
  const narrowPrimary = primary
    ? (() => {
        const cls = cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-ember-solid text-on-solid transition-colors duration-quick before:absolute before:-inset-0.5 before:content-[''] hover:bg-ember-hover active:bg-ember-active",
          primary.disabled && "pointer-events-none opacity-40",
        );
        const glyph = primary.icon ?? <Plus size={20} strokeWidth={1.75} />;
        return primary.href && !primary.disabled ? (
          <Link href={primary.href} aria-label={primary.label} title={primary.label} className={cls}>
            <span aria-hidden className="flex items-center">{glyph}</span>
          </Link>
        ) : (
          <button type="button" onClick={primary.onClick} aria-label={primary.label} title={primary.label} disabled={primary.disabled} className={cls}>
            <span aria-hidden className="flex items-center">{glyph}</span>
          </button>
        );
      })()
    : null;

  // Text only. The actions travel separately on desktop, because sharing a row
  // with the title squeezed it to 275px and wrapped the operator's name onto
  // two lines.
  const headerText = (
    <div className="min-w-0">
      {/* The page's name, and nothing else in the bar.

          The trail went with the owner's review: a one-word trail restated the
          rail item lit beside it, and a two-word one (CATALOG / NEW) restated
          the heading directly under it — for a whole line of the bar, on every
          page. Where a page is somewhere you can go back to, it carries its own
          link back, which a crumb could only duplicate.

          The description went the same way, and stays for a screen reader:
          orientation prose is read once and then scrolls past forever, but it
          is what tells someone arriving by keyboard what this page is for. */}
      {/* On a phone the bar above already says this, so saying it again costs
          77px before any page's own content — on thirty routes. It stands down
          ONLY when the two are the same word: on a sub-page the bar names the
          section ("Catalog") while this names the page ("Add to your
          catalog"), and that one has to stay. It stays in the document either
          way, because a page needs its heading. */}
      <h1 className={cn("type-h1 break-words text-lg sm:text-xl", (echoesBar || recordTitle) && "max-md:sr-only")}>{title}</h1>
      {description && <p className="sr-only">{description}</p>}
    </div>
  );

  /* What sits between the bar and the first thing on the page is ONE value —
     the gutter token, 16 on a phone and 20 from sm, which is also the page's
     side edge. It used to be 0 + 20 on a desktop without a row, 16 + 16 on a
     phone whose heading stood down, and 20 + 20 below a row: three different
     answers to the same question. The wrapper holds the gutter; nothing under
     it may add to it. What follows a visible heading, or a header row, is the
     smaller gap a heading and its content take. */
  const phoneActions =
    !wide && (narrowPrimary || phoneOverflow) ? (
      <>
        {phoneOverflow && <PhoneActions>{actions}</PhoneActions>}
        {narrowPrimary}
      </>
    ) : null;

  const afterHeading = !wide && (echoesBar || recordTitle ? "md:mt-section" : "mt-section");

  return (
    <div className="px-gutter pb-gutter pt-gutter">
      {/* Desktop: the title portals into the sticky bar. Below md they render
          here instead — one copy, either way. */}
      {wide && slot && createPortal(headerText, slot)}
      {back && <BarBack href={back.href} label={back.label} />}
      {recordTitle && titleSlot && createPortal(<span aria-hidden>{title}</span>, titleSlot)}
      {recordTitle && titleCompact && createPortal(<span aria-hidden>{title}</span>, titleCompact)}
      {/* Phone: the heading, unless the header already said it. */}
      {!wide && <div className={echoesBar || recordTitle ? "max-md:sr-only" : undefined}>{headerText}</div>}
      {/* Phone head line (docs/mobile.md section 6): the date or scope, quiet, and the page's scope pill at the right. */}
      {(subtitle || scope) && (
        <div className="-mt-1 mb-tight flex min-h-11 items-center justify-between gap-tight sm:hidden">
          <p className="min-w-0 truncate text-sm text-muted">{subtitle}</p>
          {scope && <div className="shrink-0">{scope}</div>}
        </div>
      )}
      {/* The header row — a RECORD page only. A way back and the record's
          state on the left, its own buttons and create button on the right,
          on one row that wraps. A list or dashboard has none: its buttons are
          in its toolbar, where the row already exists. */}
      {hasRow && (
        <div
          data-page-row={back || status ? "record" : "legacy"}
          className={cn("flex flex-wrap items-center justify-between gap-x-major gap-y-tight", afterHeading)}
        >
          {((back && !backInBar) || status) && (
            <div className="flex min-w-0 flex-wrap items-center gap-x-major gap-y-tight">
              {back && !backInBar && (
                <Link href={back.href} className="-ml-tight inline-flex min-h-11 items-center gap-inline rounded-sm px-tight text-sm text-muted hover:text-fg md:min-h-9">
                  <ArrowLeft size={14} strokeWidth={1.5} aria-hidden /> {back.label}
                </Link>
              )}
              {status}
            </div>
          )}
          {((actions && !phoneOverflow) || (wide && widePrimary)) && (
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-tight max-md:ml-0 max-md:w-full max-md:justify-start">
              {!phoneOverflow && actions}
              {wide && widePrimary}
            </div>
          )}
        </div>
      )}
      <div className={hasRow ? "mt-tight" : afterHeading || undefined}>
        {phoneActions && !inlineSlot && <div className="mb-tight flex items-center justify-end gap-inline md:hidden">{phoneActions}</div>}
        {phoneActions && inlineSlot && createPortal(phoneActions, inlineSlot)}
        <PhoneActionsContext value={setInlineSlot}>{children}</PhoneActionsContext>
      </div>
    </div>
  );
}

const PhoneActionsContext = createContext<((el: HTMLElement | null) => void) | null>(null);

/**
 * Where a phone page's actions go: the orange create button and the "⋯", at the
 * right of the page's first toolbar row (docs/mobile.md section 8, v8). Drawn
 * only below md, and only inside a PageShell; elsewhere it renders nothing.
 */
export function PhoneActionsSlot({ className }: { className?: string }) {
  const set = useContext(PhoneActionsContext);
  if (!set) return null;
  return <div ref={set} data-phone-actions className={cn("flex shrink-0 items-center gap-inline empty:hidden md:hidden", className)} />;
}
