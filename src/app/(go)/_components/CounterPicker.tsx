"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import { Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { listCounters, listLocations, peekCounters, type Counter } from "@/lib/api";
import { counterIsOpen, setActiveCounter, useActiveCounter } from "@/lib/activeCounter";

/**
 * Which counter this device is selling at, chosen from the Go header.
 *
 * The list is the counters an operator set up in OS (Settings, Counters), grouped
 * by venue. A counter that is open can be chosen; one that is closed is shown
 * but cannot, and says where it is opened — a cashier should not have to guess
 * why a counter they know is missing. Choosing one moves the whole till to that
 * counter's venue: see `lib/activeCounter`.
 *
 * Changing counter with a sale in progress is refused, with the reason and a
 * way back to the sale. The lines in a sale were priced, held and taken off the
 * shelf of the venue that started it; carrying them to another venue would
 * file them against stock that is not there, and clearing them would throw a
 * customer's order away. Taking payment or pausing the sale are both one tap
 * from here, so refusing costs less than either alternative.
 *
 * The chip names the counter on the first line and its venue under it. On a
 * phone it is the one flexible thing in the header, so both lines truncate
 * with an ellipsis; the full names are in its accessible name.
 */
export function CounterPicker({ saleCount }: { saleCount: number }) {
  const t = useTranslations("pos.shell");
  const router = useRouter();
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const counters = countersQ.data?.data ?? peekCounters();
  const { counter: active } = useActiveCounter(counters);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<Counter | null>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const venueName = (id: string) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? "";
  const groups = (() => {
    const byVenue = new Map<string, Counter[]>();
    for (const c of counters) byVenue.set(c.locationId, [...(byVenue.get(c.locationId) ?? []), c]);
    return [...byVenue.entries()]
      .map(([id, list]) => ({ id, name: venueName(id), list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) chip.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    countersQ.reload();
    // Focus lands on the chosen counter, so the keyboard starts where the till is.
    const first = panel.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel.current?.querySelector<HTMLElement>('[role="radio"]:not([aria-disabled="true"])');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="radio"]:not([aria-disabled="true"])') ?? []);
      if (items.length === 0) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the list opens
  }, [open]);

  const choose = (c: Counter) => {
    if (!counterIsOpen(c)) return;
    if (c.id === active?.id) { close(); return; }
    if (saleCount > 0) { setOpen(false); setBlocked(c); return; }
    setActiveCounter(c.id);
    close();
  };

  const name = active?.name ?? t("counterNone");
  const venue = active ? venueName(active.locationId) : "";

  return (
    <div className="min-w-0 flex-1 sm:relative sm:max-w-[20rem] sm:flex-none">
      <button
        ref={chip}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={active ? t("counterChipAria", { name, venue }) : t("counterNone")}
        data-counter-chip
        className="flex h-11 w-full min-w-0 items-center gap-inline rounded-full px-comfortable text-left transition-colors duration-quick hover:bg-subtle active:bg-muted-wash"
      >
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[0.875rem] font-semibold text-fg">{name}</span>
          {venue && <span className="truncate text-[0.8125rem] text-muted">{venue}</span>}
        </span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden className={cn("shrink-0 text-muted transition-transform duration-quick", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => close(false)} aria-hidden />
          <div
            ref={panel}
            role="dialog"
            aria-label={t("counterTitle")}
            className="go-raised fixed inset-x-tight top-[60px] z-50 max-h-[calc(100dvh-76px)] overflow-y-auto p-tight sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+6px)] sm:w-[22rem]"
          >
            <p className="px-comfortable pb-inline pt-tight text-[0.875rem] font-semibold text-muted">{t("counterTitle")}</p>
            {groups.length === 0 && <p className="px-comfortable py-comfortable text-[0.875rem] text-muted">{t("counterNone")}</p>}
            {groups.map((g) => (
              <div key={g.id} role="radiogroup" aria-label={g.name} className="pb-tight">
                <p className="px-comfortable pb-inline pt-tight text-[0.8125rem] font-semibold text-muted">{g.name}</p>
                {g.list.map((c) => {
                  const isOpen = counterIsOpen(c);
                  const chosen = c.id === active?.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={chosen}
                      aria-disabled={!isOpen || undefined}
                      data-counter={c.id}
                      onClick={() => choose(c)}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-tight rounded-go-sm px-comfortable py-tight text-left transition-colors duration-quick",
                        !isOpen ? "cursor-not-allowed" : chosen ? "bg-ember/[0.08]" : "hover:bg-subtle active:bg-muted-wash",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col leading-snug">
                        <span className={cn("text-[0.9375rem] font-semibold", isOpen ? "text-fg" : "text-muted")}>{c.name}</span>
                        {!isOpen && (
                          <span className="text-[0.8125rem] text-muted">
                            <span className="font-semibold text-danger">{t("counterClosed")}</span> · {t("counterClosedHelp")}
                          </span>
                        )}
                      </span>
                      {chosen && <Check size={18} strokeWidth={2.5} aria-hidden className="shrink-0 text-brand-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        open={!!blocked}
        onClose={() => setBlocked(null)}
        title={t("counterBusyTitle")}
        footer={
          <>
            <button type="button" onClick={() => setBlocked(null)} className="flex h-12 items-center rounded-full border-2 border-line bg-card px-comfortable text-[1rem] font-semibold text-fg">
              {t("close")}
            </button>
            <button type="button" onClick={() => { setBlocked(null); router.push("/pos/cart"); }} className="flex h-12 items-center rounded-full bg-ember-solid px-comfortable text-[1rem] font-semibold text-white">
              {t("counterBusyBack")}
            </button>
          </>
        }
      >
        <p className="text-[0.9375rem]">{t("counterBusyBody", { name: active?.name ?? "", other: blocked?.name ?? "" })}</p>
      </Modal>
    </div>
  );
}
