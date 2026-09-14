"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
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
 * The search box in the top bar — which searches.
 *
 * It was an input with a Ctrl K hint and no behaviour: typing into it did
 * nothing, and the shortcut it advertised was not bound. A box that looks like
 * search and is not is worse than no box, because the person who tries it
 * concludes the thing they wanted does not exist.
 *
 * What it finds is where to go: every page in the app, and every settings
 * section by the words someone would type rather than where it is filed —
 * "vat" finds Tax, "bkash" finds Payments, "dark mode" finds Preferences, the
 * same keywords the settings index searches. Arrow keys move, Enter goes, Esc
 * clears. It is a combobox with a listbox, so a screen reader hears how many
 * results there are and which one is chosen.
 */
export function HeaderSearch({
  destinations,
  shortcutKey,
}: {
  destinations: readonly { href: string; key: string }[];
  shortcutKey: string;
}) {
  const tn = useTranslations("nav");
  const ts = useTranslations("settings");
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const all = useMemo<Result[]>(() => {
    const pages = destinations
      .filter((d) => d.key !== "promotions" || FEATURES.promotions)
      .map((d) => ({ href: d.href, title: tn(d.key), hint: tn("searchPage"), words: split(tn(d.key)) }));
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
  const results = typed.length === 0 ? [] : all.filter((r) => typed.every((w) => r.words.some((h) => h.startsWith(w)))).slice(0, 8);
  const showList = open && typed.length > 0;
  const current = Math.min(active, Math.max(results.length - 1, 0));

  const go = (r: Result) => {
    setQuery("");
    setOpen(false);
    // Leave the box, so the next Ctrl K is a fresh search rather than a no-op.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    router.push(r.href);
  };

  return (
    <div className="relative hidden lg:block lg:w-64">
      <div className="flex items-center gap-tight rounded-sm border border-line bg-card/60 px-comfortable py-tight text-sm text-muted transition-colors duration-quick hover:bg-card focus-within:ring-2 focus-within:ring-ember/20">
        <Search size={16} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
        <input
          id="os-search"
          type="text"
          role="combobox"
          aria-label={tn("search")}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[current] ? `${listId}-${current}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={tn("search")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive(Math.min(current + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive(Math.max(current - 1, 0));
            } else if (e.key === "Enter") {
              const r = results[current];
              if (r) {
                e.preventDefault();
                go(r);
              }
            } else if (e.key === "Escape") {
              if (query) setQuery("");
              else e.currentTarget.blur();
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-faint"
        />
        {/* `muted`, not `faint`: faint is the disabled-foreground token and this
            is a live hint on a filled chip — it measured 1.77:1 on every OS
            page. */}
        <kbd className="rounded-xs bg-subtle px-1.5 py-0.5 font-mono text-[12px] text-muted">{shortcutKey}</kbd>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={tn("search")}
          className="absolute right-0 top-[calc(100%+6px)] z-40 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-line bg-card py-inline shadow-lg"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-comfortable py-tight text-[13px] text-muted">
              {tn("searchEmpty", { query: query.trim() })}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.href}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === current}
                // Keep focus in the box, so the click lands before blur closes the list.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center justify-between gap-section px-comfortable py-tight text-sm text-fg",
                  i === current && "bg-subtle ring-1 ring-inset ring-line",
                )}
              >
                <span className="min-w-0 truncate">{r.title}</span>
                <span className="shrink-0 text-[12px] text-muted">{r.hint}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
