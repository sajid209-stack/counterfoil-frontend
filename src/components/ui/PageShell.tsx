"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
 * Separate from `actions` because the two want different room. On a phone a
 * full-width "Add to your catalog" is 151px of a 358px line, on a page that
 * already spends 451px before its first row — so the primary moves into the
 * top bar as an ink plus, and its words become its accessible name. The page's
 * other `actions` go behind a round "⋯" beside it (`PhoneActions`), which is
 * Shopify admin mobile's header exactly: the one thing you came to do, and the
 * rest one tap away. Nothing is crammed into a bar that cannot hold it.
 *
 * A page declares it rather than PageShell guessing which of its buttons is
 * the important one.
 *
 * On a desktop it is drawn by the page, in its first toolbar (`PageToolbar`),
 * or in a record page's header row — never in a row of its own.
 */
export interface PagePrimary {
  label: string;
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
 * The phone bar's back arrow, portalled into the slot OsShell leaves at the left
 * of the bar. While it is there the bar's own page glyph (or the settings
 * section chevron) steps aside — the arrow takes that place.
 */
export function BarBack({ href, label }: { href: string; label: string }) {
  const t = useTranslations("nav");
  const wide = useMediaQuery(MD);
  const slot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-back-mobile"), () => null);
  if (wide || !slot) return null;
  return createPortal(
    <Link
      href={href}
      aria-label={t("backTo", { label })}
      data-bar-back
      className="-ml-tight flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg transition-colors duration-quick hover:bg-fg/[0.06] active:bg-fg/[0.08]"
    >
      <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
    </Link>,
    slot,
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
 * A page's secondary actions on a phone: a round "⋯" in the top bar that opens
 * them in a small panel under it.
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
          "flex h-11 w-11 items-center justify-center rounded-full text-fg transition-colors duration-quick hover:bg-fg/[0.06] active:bg-fg/[0.08]",
          open && "bg-fg/[0.07]",
        )}
      >
        <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden />
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
  children,
}: {
  title: string;
  description?: string;
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
  const barSlot = useSyncExternalStore(noSubscribe, () => document.getElementById("os-page-actions-mobile"), () => null);

  /* A phone does not have room for a page's buttons beside its title, so they
     go behind the bar's round "⋯" — but only when there IS a bar to put it in:
     a PageShell rendered outside the OS shell keeps them in the page. */
  const phoneOverflow = !wide && !!barSlot && !!actions;
  const backInBar = useBackInBar();
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
  /* Phone: the glyph, in the bar, with the words as its name — a compact ink
     disc with a plus, the way Shopify admin mobile draws its one create action.
     The target is 44px; the disc inside it is 36. */
  const narrowPrimary = primary
    ? (() => {
        const cls = cn(
          "flex h-11 w-11 items-center justify-center rounded-full transition-opacity duration-quick active:opacity-80",
          primary.disabled && "pointer-events-none opacity-40",
        );
        const body = (
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-inverse text-inverse-fg">
            {primary.icon ?? <Plus size={18} strokeWidth={2} />}
          </span>
        );
        return primary.href && !primary.disabled ? (
          <Link href={primary.href} aria-label={primary.label} className={cls}>
            {body}
          </Link>
        ) : (
          <button type="button" onClick={primary.onClick} aria-label={primary.label} disabled={primary.disabled} className={cls}>
            {body}
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
      <h1 className={cn("type-h1 break-words text-[1.375rem] sm:text-[1.75rem]", echoesBar && "max-sm:sr-only")}>{title}</h1>
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
  const afterHeading = !wide && (echoesBar ? "sm:mt-section" : "mt-section");

  return (
    <div className="px-gutter pb-gutter pt-gutter">
      {/* Desktop: the title portals into the sticky bar. Below md they render
          here instead — one copy, either way. */}
      {wide && slot && createPortal(headerText, slot)}
      {/* The plus and the "⋯" live in the phone's bar, at the right of the page's
          name. */}
      {!wide && (narrowPrimary || phoneOverflow) && barSlot &&
        createPortal(
          <>
            {narrowPrimary}
            {phoneOverflow && <PhoneActions>{actions}</PhoneActions>}
          </>,
          barSlot,
        )}
      {back && <BarBack href={back.href} label={back.label} />}
      {/* Phone: the heading, unless the bar already said it. */}
      {!wide && <div className={echoesBar ? "max-sm:sr-only" : undefined}>{headerText}</div>}
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
                <Link href={back.href} className="-ml-tight inline-flex min-h-11 items-center gap-inline rounded-sm px-tight text-[13px] text-muted hover:text-fg md:min-h-9">
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
      <div className={hasRow ? "mt-tight" : afterHeading || undefined}>{children}</div>
    </div>
  );
}
