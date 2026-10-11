"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Menu, Moon, Sun } from "lucide-react";
import { Button, Logo, LogoMark, SegmentedControl, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GROUPS, SECTIONS, neighbours, sectionPath, type SectionMeta } from "../_sections/registry";
import { useDsConfig, type DsMode, type DsProduct } from "./DsConfig";

/**
 * The frame around every Design System page: a top bar, a sticky section nav,
 * the content column and an "On this page" list.
 *
 * The chrome keeps the SITE's theme. The two switches in the bar do not change
 * it — they drive the preview wrappers only (see Preview), so the docs stay
 * readable while a dark POS configuration is on screen.
 */

function ConfigSwitches() {
  const cfg = useDsConfig();
  return (
    <>
      <SegmentedControl
        aria-label="Product"
        value={cfg.product}
        onChange={(v) => cfg.setProduct(v as DsProduct)}
        options={[
          { value: "os", label: "OS" },
          { value: "go", label: "POS" },
        ]}
      />
      <SegmentedControl
        aria-label="Mode"
        value={cfg.mode ?? ""}
        onChange={(v) => cfg.setMode(v as DsMode)}
        options={[
          { value: "light", label: "Light", icon: <Sun size={14} strokeWidth={1.5} aria-hidden className="max-sm:hidden" /> },
          { value: "dark", label: "Dark", icon: <Moon size={14} strokeWidth={1.5} aria-hidden className="max-sm:hidden" /> },
        ]}
      />
    </>
  );
}

function StatusTag({ s }: { s: SectionMeta }) {
  if (s.status === "done") return null;
  return <span className="ml-auto shrink-0 rounded-full bg-subtle px-tight text-xs text-muted">{s.status === "partial" ? "Part" : "Soon"}</span>;
}

/** The grouped section list. Used in the sticky column and in the phone sheet. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const cfg = useDsConfig();
  return (
    <nav aria-label="Design System sections" className="flex flex-col gap-section">
      {GROUPS.map((group) => (
        <div key={group}>
          <p className="px-comfortable pb-inline text-sm font-semibold text-muted">{group}</p>
          <ul className="flex flex-col">
            {SECTIONS.filter((s) => s.group === group).map((s) => {
              const path = sectionPath(s.slug);
              const current = pathname === path;
              return (
                <li key={s.slug}>
                  <Link
                    href={cfg.href(path)}
                    onClick={onNavigate}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-tight rounded-control px-comfortable text-sm transition-colors duration-quick md:min-h-9",
                      current ? "bg-muted-wash font-medium text-fg" : "text-muted hover:bg-muted-wash hover:text-fg",
                    )}
                  >
                    <span className="w-5 shrink-0 text-xs tabular-nums text-muted">{s.number}</span>
                    <span className="min-w-0 truncate">{s.title}</span>
                    <StatusTag s={s} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/* "On this page" is read from the headings that are actually on screen, so it
   can never list a section that is not there or miss one that is. The DOM is an
   external store: the observer is its subscription, and the snapshot is a
   string, so React sees "no change" until a heading really changes. */
function subscribeHeadings(cb: () => void) {
  const root = document.getElementById("ds-main");
  if (!root) return () => {};
  const mo = new MutationObserver(cb);
  mo.observe(root, { childList: true, subtree: true, characterData: true });
  return () => mo.disconnect();
}
const headingsSnapshot = () =>
  Array.from(document.querySelectorAll<HTMLElement>("#ds-main h2[id]"))
    .map((h) => `${h.id}|${h.textContent ?? ""}`)
    .join("\n");

function OnThisPage() {
  const raw = useSyncExternalStore(subscribeHeadings, headingsSnapshot, () => "");
  const items = raw ? raw.split("\n").map((l) => ({ id: l.slice(0, l.indexOf("|")), label: l.slice(l.indexOf("|") + 1) })) : [];
  if (items.length < 2) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-tight">
      <p className="text-sm font-semibold text-fg">On this page</p>
      <ul className="flex flex-col border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} className="-ml-px block border-l border-transparent py-inline pl-comfortable text-sm text-muted transition-colors duration-quick hover:border-strong hover:text-fg">
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Previous and next section, at the foot of every page. */
export function PrevNext({ slug }: { slug: string }) {
  const cfg = useDsConfig();
  const { prev, next } = neighbours(slug);
  return (
    <nav aria-label="Previous and next section" className="mt-hero grid gap-section border-t border-hairline pt-major sm:grid-cols-2">
      {prev ? (
        <Link href={cfg.href(sectionPath(prev.slug))} className="group flex min-h-11 flex-col gap-inline rounded-md p-comfortable transition-colors duration-quick hover:bg-muted-wash">
          <span className="flex items-center gap-inline text-sm text-muted">
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden /> Previous
          </span>
          <span className="text-md font-semibold text-fg">{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={cfg.href(sectionPath(next.slug))} className="group flex min-h-11 flex-col items-end gap-inline rounded-md p-comfortable text-right transition-colors duration-quick hover:bg-muted-wash">
          <span className="flex items-center gap-inline text-sm text-muted">
            Next <ArrowRight size={14} strokeWidth={1.5} aria-hidden />
          </span>
          <span className="text-md font-semibold text-fg">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}

export function DsShell({ children }: { children: React.ReactNode }) {
  const cfg = useDsConfig();
  const [sections, setSections] = useState(false);

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <a
        href="#ds-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-tight focus:top-tight focus:z-50 focus:rounded-control focus:bg-card focus:px-comfortable focus:py-tight focus:text-sm focus:font-medium focus:shadow-md"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-hairline bg-chrome dark:border-line">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-x-comfortable gap-y-tight px-gutter py-tight">
          <Link href={cfg.href("/design-system")} className="flex min-h-11 items-center gap-comfortable rounded-control">
            <span className="sm:hidden">
              <LogoMark size={24} />
            </span>
            <span className="hidden sm:inline-flex">
              <Logo size={20} />
            </span>
            <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
            <span className="text-md font-semibold tracking-title text-fg">Design System</span>
          </Link>

          <div className="order-last flex w-full items-center gap-tight sm:order-none sm:ml-auto sm:w-auto">
            <Button variant="secondary" className="lg:hidden" icon={<Menu size={16} strokeWidth={1.5} aria-hidden />} onClick={() => setSections(true)} aria-haspopup="dialog">
              Sections
            </Button>
            <ConfigSwitches />
          </div>

          <Link
            href="/dashboard"
            aria-label="Back to Counterfoil OS"
            className="ml-auto inline-flex min-h-11 items-center gap-tight rounded-control px-comfortable text-sm text-muted transition-colors duration-quick hover:text-fg sm:ml-0"
          >
            <ArrowLeft size={14} strokeWidth={1.5} aria-hidden />
            <span className="hidden md:inline">Back to Counterfoil OS</span>
            <span className="md:hidden">OS</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[90rem] items-start gap-wide px-gutter">
        <aside className="no-scrollbar sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto py-major lg:block">
          <NavList />
        </aside>

        <main id="ds-main" tabIndex={-1} className="min-w-0 flex-1 py-wide outline-none">
          <div className="mx-auto max-w-[60rem]">{children}</div>
        </main>

        <aside className="no-scrollbar sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-48 shrink-0 overflow-y-auto py-wide xl:block">
          <OnThisPage />
        </aside>
      </div>

      <Sheet open={sections} onClose={() => setSections(false)} title="Sections" closeLabel="Close sections">
        <div className="p-section">
          <NavList onNavigate={() => setSections(false)} />
        </div>
      </Sheet>
    </div>
  );
}
