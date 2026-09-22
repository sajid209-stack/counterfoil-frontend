"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { FEATURES } from "@/lib/features";
import { SETTINGS_GROUPS } from "../settings/_lib/nav";

interface Result {
  href: string;
  title: string;
  hint: string;
  words: string[];
}

const split = (s: string) => s.toLowerCase().split(/[\s,.·—–()/]+/).filter(Boolean);

/**
 * Search, as one palette instead of a box in the top bar.
 *
 * The owner's review asked for the search to be "a dedicated button on the
 * side" rather than a field wearing 256px of the header. A button needs
 * somewhere to open into, and the answer the whole industry has settled on is
 * a command palette: one overlay, reached from the rail, from the phone's top
 * bar, or from Ctrl/⌘ K, showing the same results however it was opened.
 *
 * What it finds is unchanged — every page in the app and every settings
 * section, by the words someone would type rather than where the thing is
 * filed: "vat" finds Tax, "bkash" finds Payments, "dark mode" finds
 * Preferences. Two things are new. It opens with the destination list already
 * on screen, so an empty palette is a menu rather than a void; and it is
 * reachable on a phone, where the old field was `hidden lg:block` and there
 * was no search at all below 1024.
 *
 * It is the ARIA combobox pattern: the input keeps focus, `aria-activedescendant`
 * points at the highlighted row, and the arrow keys move that pointer without
 * moving focus — so a screen reader hears the count and the current option.
 */
export function CommandPalette({
  onClose,
  destinations,
  shortcutKey,
}: {
  onClose: () => void;
  destinations: readonly { href: string; key: string }[];
  shortcutKey: string;
}) {
  const tn = useTranslations("nav");
  const ts = useTranslations("settings");
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  /** Where focus was before the palette opened, so it can be handed back. */
  const opener = useRef<HTMLElement | null>(null);

  const all = useMemo<Result[]>(() => {
    const pages = destinations
      .filter((d) => d.key !== "promotions" || FEATURES.promotions)
      /* A page answers to its old names too: Catalog is where "bookings" and
         "events" went, and a hand that types the word it used for months
         should still land. */
      .map((d) => ({
        href: d.href,
        title: tn(d.key),
        hint: tn("searchPage"),
        words: split(`${tn(d.key)} ${tn.has(`aliases.${d.key}`) ? tn(`aliases.${d.key}`) : ""}`),
      }));
    const settings = SETTINGS_GROUPS.flatMap((g) =>
      g.items.map((item) => {
        const title = ts(`nav.items.${item.key}.title`);
        return {
          href: item.href,
          title,
          hint: ts(`nav.groups.${g.key}.title`),
          words: split(`${title} ${ts(`nav.items.${item.key}.desc`)} ${ts(`nav.items.${item.key}.keywords`)}`),
        };
      }),
    );
    return [...pages, ...settings];
  }, [destinations, tn, ts]);

  // Every word typed has to start a word somewhere in the result, so "card
  // payment" narrows rather than widens — the settings index's own rule.
  const typed = split(query);
  const searching = typed.length > 0;
  const results = searching
    ? all.filter((r) => typed.every((w) => r.words.some((h) => h.startsWith(w)))).slice(0, 8)
    : // Nothing typed: the destinations, which is what a palette opened by
      // accident should show. Settings sections are held back until a word
      // narrows them — thirty rows of them is a list, not a menu.
      all.filter((r) => r.hint === tn("searchPage")).slice(0, 8);
  const current = Math.min(active, Math.max(results.length - 1, 0));

  /* The shell MOUNTS this when the palette opens and unmounts it when it
     closes, so a reopened palette starts empty because it is a new component —
     not because an effect reached in and cleared it. That is also what keeps
     this file free of a setState-in-effect, which is an error in this repo. */
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const id = requestAnimationFrame(() => input.current?.focus());
    const prev = document.body.style.overflow;
    // The page behind does not scroll while this is over it.
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      const back = opener.current;
      if (back && document.contains(back)) back.focus();
    };
  }, []);

  // Keep the highlighted row in view when the arrows walk past the fold.
  useEffect(() => {
    list.current?.querySelector(`#${CSS.escape(`${listId}-${current}`)}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  const go = (r: Result) => {
    onClose();
    router.push(r.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-section pt-[12vh] sm:pt-[15vh]" role="dialog" aria-modal="true" aria-label={tn("search")}>
      <div className="absolute inset-0 bg-inverse/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />

      {/* Solid, not `glass`. The Modal's frosted panel is right over a page you
          are meant to keep seeing; this is a dense list of 13px rows, and
          measured on it `muted` came to 4.02:1 in dark — the translucency
          lightens the ground the hint text was tuned against. It also matches
          the account menu and the row menus, which are the popovers this one
          sits beside. */}
      <div className="relative z-10 flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-line bg-card shadow-lg">
        {/* The field is the dialog's title — no second heading above it. 16px
            on the input itself, because anything smaller makes mobile Safari
            zoom the page the moment it takes focus. */}
        {/* `data-focus-host`: the global :focus-visible rule is unlayered, so a
            bare input draws a 2px rectangle across the panel's own rounded top
            corners. The rule under the field turns ember instead — the same
            shape-following swap the till's search pill makes. */}
        <div data-focus-host className="flex items-center gap-comfortable border-b border-line px-comfortable transition-colors duration-quick focus-within:border-ember">
          <Search size={18} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={input}
            id="os-search"
            type="text"
            role="combobox"
            aria-label={tn("search")}
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={results[current] ? `${listId}-${current}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={tn("searchPlaceholder")}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive(Math.min(current + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive(Math.max(current - 1, 0));
              } else if (e.key === "Enter") {
                const r = results[current];
                if (r) { e.preventDefault(); go(r); }
              } else if (e.key === "Escape") {
                e.preventDefault();
                if (query) setQuery("");
                else onClose();
              } else if (e.key === "Tab") {
                // One focusable thing in here. Tab would leave the palette
                // open with focus on the page behind it.
                e.preventDefault();
              }
            }}
            className="min-w-0 flex-1 bg-transparent py-comfortable text-[16px] text-fg outline-none placeholder:text-faint"
          />
          <kbd className="hidden shrink-0 rounded-xs bg-subtle px-1.5 py-0.5 font-mono text-[12px] text-muted sm:block">{shortcutKey}</kbd>
        </div>

        <ul ref={list} id={listId} role="listbox" aria-label={tn("search")} className="min-h-0 flex-1 overflow-y-auto py-inline">
          {!searching && (
            <li role="presentation" className="px-comfortable pb-inline pt-tight font-mono text-[12px] uppercase tracking-wider text-muted">
              {tn("searchGoTo")}
            </li>
          )}
          {results.length === 0 ? (
            <li role="presentation" className="px-comfortable py-comfortable text-[13px] text-muted">
              {tn("searchEmpty", { query: query.trim() })}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.hint}|${r.href}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                // Keep focus in the box, so the click lands on the row rather
                // than on a field that has just lost its selection.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "mx-inline flex min-h-11 cursor-pointer items-center justify-between gap-section rounded-sm px-comfortable py-tight text-sm text-fg",
                  i === current && "bg-subtle",
                )}
              >
                <span className="min-w-0 truncate font-medium">{r.title}</span>
                <span className="flex shrink-0 items-center gap-tight text-[12px] text-muted">
                  {r.hint}
                  {i === current && <CornerDownLeft size={14} strokeWidth={1.5} aria-hidden />}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
