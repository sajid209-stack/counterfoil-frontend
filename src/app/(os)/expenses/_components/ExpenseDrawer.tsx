"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ImagePlus, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Button, DateField, Modal, Select, Sheet } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDay, formatMoney } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/schedule";
import { useActiveCounterNow } from "@/lib/activeCounter";
import {
  createExpense,
  EXPENSE_CATEGORIES,
  PAID_FROM,
  peekCounters,
  peekStaff,
  updateExpense,
  type Expense,
  type ExpenseCategory,
  type ExpenseProblemCode,
  type Location,
  type PaidFrom,
} from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { blankLine, emptyForm, formTotal, fromExpense, lineMinor, readForm, snapshot, switchMode, type FormLine, type FormState } from "./form";
import { CATEGORY_ICON, PAID_ICON, useExpenseLabels } from "./parts";

export type DrawerMode = "new" | "edit" | "copy";

const UNITS = ["pcs", "kg", "litre", "box", "pack", "bottle", "roll", "pair", "hr", "day", "job", "trip"];

const input = "h-11 w-full rounded-sm border bg-card px-comfortable text-[14px] outline-none transition-colors duration-quick placeholder:text-muted focus:border-inverse";
const edge = (bad: boolean) => (bad ? "border-danger" : "border-line");

/** A message beside its field, in words. */
function Problem({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} role="alert" className="mt-inline text-[12px] text-danger">
      {text}
    </p>
  ) : null;
}

/** A small label above a control. */
function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] font-medium text-muted">
      {children}
    </label>
  );
}

/** One answer out of a few, as big touch targets. A radio group by its roles
 *  and its arrow keys, so a keyboard and a screen reader both get it. */
function Chips<V extends string>({
  label,
  value,
  options,
  onChange,
  columns,
  row,
  invalid,
  describedBy,
}: {
  label: string;
  value: V | "";
  options: { value: V; label: string; icon: LucideIcon }[];
  onChange: (v: V) => void;
  columns: string;
  /** Icon beside the word rather than above it. */
  row?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const at = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (to: number) => {
    const next = (to + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn("grid gap-tight", columns)}>
      {options.map((o, i) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === at ? 0 : -1}
            data-invalid={invalid && i === at ? "true" : undefined}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i + 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i - 1);
              }
            }}
            className={cn(
              "relative flex items-center justify-center rounded-md border text-[13px] outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-ink",
              row ? "h-11 gap-tight px-comfortable" : "min-h-[60px] flex-col gap-inline px-inline py-tight",
              on ? "border-ember bg-ember/10 font-medium text-fg" : "border-line bg-card text-fg hover:border-inverse",
            )}
          >
            <Icon size={row ? 16 : 20} strokeWidth={1.5} aria-hidden />
            <span className="min-w-0 truncate">{o.label}</span>
            {on && <Check size={13} strokeWidth={2.5} aria-hidden className="absolute right-1.5 top-1.5 text-brand-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

export function ExpenseDrawer({
  mode,
  expense,
  locations,
  locationId,
  payees,
  onClose,
  onSaved,
  onDelete,
  covered,
  onUncover,
}: {
  mode: DrawerMode;
  /** The expense being viewed, edited, or copied. */
  expense?: Expense;
  locations: Location[];
  /** The venue in the bar: where a new expense goes unless it is changed here. */
  locationId: string;
  payees: string[];
  onClose: () => void;
  onSaved: (saved: Expense, kind: "created" | "updated") => void;
  onDelete: (e: Expense) => void;
  /** Something the page opened (the delete question) is on top of this drawer. */
  covered: boolean;
  /** Esc was pressed while it was: take that away rather than this drawer. */
  onUncover: () => void;
}) {
  const t = useTranslations("expenses");
  const labels = useExpenseLabels();
  const uid = useId();
  const field = (n: string) => `${uid}-${n}`;
  const active = useActiveCounterNow();
  const staff = peekStaff();
  const me = staff.find((s) => s.id === DEMO_STAFF_ID)?.name ?? "";

  const counterFor = useCallback(
    (loc: string) => {
      const here = peekCounters().filter((c) => c.locationId === loc && c.status !== "archived");
      return (here.find((c) => c.id === active.id) ?? here.find((c) => c.status === "active") ?? here[0])?.id ?? "";
    },
    [active.id],
  );

  const [form, setForm] = useState<FormState>(() => {
    if (!expense) return emptyForm(locationId, counterFor(locationId));
    const f = fromExpense(expense);
    // A copy is a new expense for today, with its own receipt.
    return mode === "copy" ? { ...f, date: DEMO_TODAY, receiptUrl: "" } : f;
  });
  const [initial] = useState(() => snapshot(form));
  const dirty = snapshot(form) !== initial;
  const [problems, setProblems] = useState<Record<string, ExpenseProblemCode>>({});
  const [banner, setBanner] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [receiptBig, setReceiptBig] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  /** Photos picked in this drawer, so one that is never saved can be let go. */
  const picked = useRef(new Set<string>());
  const wantFocus = useRef<string | null>(null);
  const total = formTotal(form);
  const editing = mode === "edit" && !!expense;

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const say = (code: ExpenseProblemCode | undefined) => (code ? t(`error.${code}`) : undefined);
  const clear = (...keys: string[]) => setProblems((p) => (keys.some((k) => k in p) ? Object.fromEntries(Object.entries(p).filter(([k]) => !keys.includes(k))) : p));

  // A new row gets the cursor once it exists.
  useEffect(() => {
    if (!wantFocus.current) return;
    bodyRef.current?.querySelector<HTMLElement>(`[data-line="${wantFocus.current}"] input`)?.focus();
    wantFocus.current = null;
  });

  // ── closing ──
  const live = useRef({ dirty, confirming, covered });
  useEffect(() => {
    live.current = { dirty, confirming, covered };
  });
  const uncoverRef = useRef(onUncover);
  useEffect(() => {
    uncoverRef.current = onUncover;
  });
  const letGo = () => {
    for (const url of picked.current) if (url !== form.receiptUrl) URL.revokeObjectURL(url);
  };
  const finish = () => {
    for (const url of picked.current) URL.revokeObjectURL(url);
    onClose();
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  /** Esc, the ×, the backdrop and Cancel all come here. Stable on purpose: the
   *  sheet re-arms its key handler and its focus return whenever this changes,
   *  and the form changes on every key. */
  const requestClose = useCallback(() => {
    // Esc belongs to an open calendar or list first: the sheet hears it before
    // they do, so close theirs by hand.
    const pop = document.querySelector<HTMLElement>('[aria-haspopup][aria-expanded="true"]');
    if (pop) {
      pop.click();
      pop.focus();
      return;
    }
    if (live.current.covered) {
      uncoverRef.current();
      return;
    }
    if (live.current.confirming) {
      setConfirming(false);
      return;
    }
    if (live.current.dirty) setConfirming(true);
    else finishRef.current();
  }, [setConfirming]);

  /** Stable, like `requestClose`: the dialog re-arms its focus handling when this changes. */
  const keepEditing = useCallback(() => setConfirming(false), [setConfirming]);

  // ── the receipt ──
  const pickReceipt = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (picked.current.has(form.receiptUrl)) {
      URL.revokeObjectURL(form.receiptUrl);
      picked.current.delete(form.receiptUrl);
    }
    picked.current.add(url);
    patch({ receiptUrl: url });
  };
  const dropReceipt = () => {
    if (picked.current.has(form.receiptUrl)) {
      URL.revokeObjectURL(form.receiptUrl);
      picked.current.delete(form.receiptUrl);
    }
    patch({ receiptUrl: "" });
    setReceiptBig(false);
  };

  // ── the items ──
  const setLine = (key: string, p: Partial<FormLine>, ...clears: string[]) => {
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) }));
    clear(...clears);
  };
  const addLine = () => {
    const l = blankLine();
    wantFocus.current = l.key;
    setForm((f) => ({ ...f, lines: [...f.lines, l] }));
  };
  const removeLine = (key: string) => {
    setForm((f) => (f.lines.length <= 1 ? { ...f, lines: [blankLine()] } : { ...f, lines: f.lines.filter((l) => l.key !== key) }));
    setProblems((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith("lines."))));
  };

  // ── saving ──
  const save = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (saving) return;
    const read = readForm(form);
    setBanner("");
    if (Object.keys(read.problems).length > 0) {
      setProblems(read.problems);
      requestAnimationFrame(() => {
        const first = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
        first?.focus();
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setProblems({});
    setSaving(true);
    const res = editing ? await updateExpense(expense!.id, read.input) : await createExpense(read.input);
    setSaving(false);
    if (!res.ok) {
      setBanner(res.error.message || t("saveFailed"));
      return;
    }
    // Keep the photo that was saved; let go of any that was replaced.
    letGo();
    onSaved(res.data, editing ? "updated" : "created");
  };

  const counters = peekCounters().filter((c) => c.locationId === form.locationId && c.status !== "archived");
  const needsCounter = form.paidFrom === "cash_drawer";
  const title = mode === "edit" ? t("drawer.editTitle") : mode === "copy" ? t("drawer.copyTitle") : t("drawer.addTitle");

  return (
    <>
      <Sheet
        open
        onClose={requestClose}
        title={title}
        closeLabel={t("drawer.close")}
        side
        lead={expense && editing ? <p className="font-mono text-[12px] text-muted">{expense.ref}</p> : undefined}
        footer={
          <>
            {editing && expense && (
              <Button variant="tertiary" onClick={() => onDelete(expense)} icon={<Trash2 size={16} strokeWidth={1.5} aria-hidden />} className="mr-auto text-danger">
                {t("drawer.delete")}
              </Button>
            )}
            <div className={cn("flex items-center gap-tight", !editing && "ml-auto")}>
              <Button variant="secondary" onClick={requestClose}>
                {t("drawer.cancel")}
              </Button>
              <Button type="submit" form={field("form")} loading={saving}>
                {editing ? t("drawer.saveChanges") : t("drawer.save")}
              </Button>
            </div>
          </>
        }
      >
        <div ref={bodyRef}>
          <form id={field("form")} onSubmit={save} noValidate className="flex flex-col gap-major p-card">
            {banner && (
              <p role="alert" className="rounded-sm border border-danger/40 bg-danger/10 px-comfortable py-tight text-[13px] text-danger">
                {banner}
              </p>
            )}

            {/* The amount comes first and is the biggest thing here: it is what
                somebody has in their head when they open this. */}
            <div>
              <Label htmlFor={field("amount")}>{form.mode === "items" ? t("drawer.totalFromItems") : t("drawer.amount")}</Label>
              {form.mode === "single" ? (
                <div className={cn("mt-inline flex h-16 items-center gap-tight rounded-md border bg-card px-section transition-colors duration-quick focus-within:border-inverse", edge(!!problems.amount))}>
                  <span aria-hidden className="text-[28px] font-semibold text-muted">৳</span>
                  <input
                    id={field("amount")}
                    data-autofocus=""
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.amount}
                    placeholder="0"
                    aria-invalid={problems.amount ? true : undefined}
                    aria-describedby={problems.amount ? field("amount-msg") : undefined}
                    onChange={(e) => {
                      patch({ amount: e.target.value });
                      clear("amount");
                    }}
                    className="min-w-0 flex-1 bg-transparent text-[32px] font-semibold tabular-nums tracking-[-0.025em] outline-none placeholder:text-muted"
                  />
                </div>
              ) : (
                <p id={field("amount")} aria-live="polite" className="mt-inline flex h-16 items-center text-[32px] font-semibold tabular-nums tracking-[-0.025em]">
                  {formatMoney(total)}
                </p>
              )}
              <Problem id={field("amount-msg")} text={say(problems.amount)} />
              <div role="group" aria-label={t("drawer.howLabel")} className="mt-comfortable inline-flex rounded-sm bg-line/60 p-inline">
                {(["single", "items"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={form.mode === m}
                    onClick={() => {
                      setForm((f) => switchMode(f, m));
                      clear("amount");
                    }}
                    className={cn(
                      "h-11 rounded-xs px-comfortable text-[13px] font-medium outline-none transition-colors duration-quick focus-visible:ring-2 focus-visible:ring-ink sm:h-9",
                      form.mode === m ? "bg-card text-fg shadow-sm ring-1 ring-line" : "text-fg/80 hover:text-fg",
                    )}
                  >
                    {t(m === "single" ? "drawer.oneAmount" : "drawer.itemByItem")}
                  </button>
                ))}
              </div>
            </div>

            {form.mode === "items" && (
              <div>
                <datalist id={field("units")}>{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                <ul className="flex flex-col gap-tight">
                  {form.lines.map((l, i) => {
                    const pk = (f: string) => problems[`lines.${i}.${f}`];
                    return (
                      <li key={l.key} data-line={l.key} className="rounded-md border border-line bg-card p-comfortable">
                        <div className="flex items-start gap-tight">
                          <div className="min-w-0 flex-1">
                            <input
                              data-autofocus={i === 0 || undefined}
                              value={l.description}
                              placeholder={t("drawer.itemPlaceholder")}
                              aria-label={t("drawer.itemLabel", { n: i + 1 })}
                              aria-invalid={pk("description") ? true : undefined}
                              aria-describedby={pk("description") ? `${l.key}-d` : undefined}
                              onChange={(e) => setLine(l.key, { description: e.target.value }, `lines.${i}.description`, "amount")}
                              className={cn(input, edge(!!pk("description")))}
                            />
                            <Problem id={`${l.key}-d`} text={say(pk("description"))} />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeLine(l.key)}
                            disabled={form.lines.length === 1 && l.description === "" && l.price === ""}
                            aria-label={t("drawer.removeItem", { n: i + 1 })}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            <Trash2 size={16} strokeWidth={1.5} aria-hidden />
                          </button>
                        </div>
                        <div className="mt-tight grid grid-cols-3 gap-tight sm:grid-cols-[4.5rem_6rem_minmax(0,1fr)_7rem]">
                          <div className="min-w-0">
                            <Label htmlFor={`${l.key}-q`}>{t("drawer.qty")}</Label>
                            <input
                              id={`${l.key}-q`}
                              inputMode="decimal"
                              value={l.qty}
                              aria-invalid={pk("qty") ? true : undefined}
                              aria-describedby={pk("qty") ? `${l.key}-qm` : undefined}
                              onChange={(e) => setLine(l.key, { qty: e.target.value }, `lines.${i}.qty`)}
                              className={cn(input, "mt-inline tabular-nums", edge(!!pk("qty")))}
                            />
                          </div>
                          <div className="min-w-0">
                            <Label htmlFor={`${l.key}-u`}>{t("drawer.unit")}</Label>
                            <input
                              id={`${l.key}-u`}
                              list={field("units")}
                              value={l.unit}
                              aria-invalid={pk("unit") ? true : undefined}
                              aria-describedby={pk("unit") ? `${l.key}-um` : undefined}
                              onChange={(e) => setLine(l.key, { unit: e.target.value }, `lines.${i}.unit`)}
                              className={cn(input, "mt-inline", edge(!!pk("unit")))}
                            />
                          </div>
                          <div className="min-w-0">
                            <Label htmlFor={`${l.key}-p`}>{t("drawer.unitPrice")}</Label>
                            <input
                              id={`${l.key}-p`}
                              inputMode="decimal"
                              value={l.price}
                              placeholder="0"
                              aria-invalid={pk("unitPrice") ? true : undefined}
                              aria-describedby={pk("unitPrice") ? `${l.key}-pm` : undefined}
                              onChange={(e) => setLine(l.key, { price: e.target.value }, `lines.${i}.unitPrice`, "amount")}
                              className={cn(input, "mt-inline tabular-nums", edge(!!pk("unitPrice")))}
                            />
                          </div>
                          <div className="col-span-3 min-w-0 sm:col-span-1">
                            <span className="block text-right text-[12px] font-medium text-muted">{t("drawer.lineTotal")}</span>
                            <span className="mt-inline flex h-11 items-center justify-end text-[14px] font-medium tabular-nums">{formatMoney(lineMinor(l))}</span>
                          </div>
                        </div>
                        <Problem id={`${l.key}-qm`} text={say(pk("qty"))} />
                        <Problem id={`${l.key}-um`} text={say(pk("unit"))} />
                        <Problem id={`${l.key}-pm`} text={say(pk("unitPrice"))} />
                      </li>
                    );
                  })}
                </ul>
                <Button variant="secondary" size="sm" onClick={addLine} icon={<Plus size={15} strokeWidth={1.75} aria-hidden />} className="mt-tight">
                  {t("drawer.addItem")}
                </Button>
              </div>
            )}

            <div>
              <Label htmlFor={field("title")}>{t("drawer.title")}</Label>
              <input
                id={field("title")}
                value={form.title}
                maxLength={120}
                autoComplete="off"
                placeholder={form.category ? t(`drawer.example.${form.category}`) : t("drawer.titlePlaceholder")}
                aria-invalid={problems.title ? true : undefined}
                aria-describedby={problems.title ? field("title-msg") : undefined}
                onChange={(e) => {
                  patch({ title: e.target.value });
                  clear("title");
                }}
                className={cn(input, "mt-inline", edge(!!problems.title))}
              />
              <Problem id={field("title-msg")} text={say(problems.title)} />
            </div>

            <div>
              <Label>{t("drawer.category")}</Label>
              <div className="mt-inline">
                <Chips<ExpenseCategory>
                  label={t("drawer.category")}
                  value={form.category}
                  options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: labels.category(c), icon: CATEGORY_ICON[c] }))}
                  onChange={(c) => {
                    patch({ category: c });
                    clear("category");
                  }}
                  columns="grid-cols-3"
                  invalid={!!problems.category}
                  describedBy={problems.category ? field("category-msg") : undefined}
                />
              </div>
              <Problem id={field("category-msg")} text={say(problems.category)} />
            </div>

            <div className="grid gap-section sm:grid-cols-2">
              <div className="min-w-0">
                <Label htmlFor={field("date")}>{t("drawer.date")}</Label>
                <DateField
                  id={field("date")}
                  className="mt-inline"
                  size="form"
                  value={form.date || null}
                  onChange={(d) => {
                    patch({ date: d });
                    clear("date");
                  }}
                  today={DEMO_TODAY}
                  max={DEMO_TODAY}
                  labels={{ open: t("drawer.chooseDate"), previousMonth: t("range.previousMonth"), nextMonth: t("range.nextMonth"), today: t("drawer.today") }}
                />
                <Problem id={field("date-msg")} text={say(problems.date)} />
              </div>
              {locations.length > 1 && (
                <div className="min-w-0">
                  <Label htmlFor={field("venue")}>{t("drawer.venue")}</Label>
                  <Select
                    id={field("venue")}
                    className="mt-inline"
                    value={form.locationId}
                    onChange={(v) => {
                      patch({ locationId: v, counterId: counterFor(v) });
                      clear("locationId", "counterId");
                    }}
                    options={locations.map((l) => ({ value: l.id, label: l.name }))}
                    aria-invalid={!!problems.locationId}
                  />
                  <Problem id={field("venue-msg")} text={say(problems.locationId)} />
                </div>
              )}
            </div>

            <div>
              <Label>{t("drawer.paidFrom")}</Label>
              <div className="mt-inline">
                <Chips<PaidFrom>
                  label={t("drawer.paidFrom")}
                  value={form.paidFrom}
                  options={PAID_FROM.map((p) => ({ value: p, label: labels.paidFrom(p), icon: PAID_ICON[p] }))}
                  onChange={(p) => {
                    patch({ paidFrom: p });
                    clear("paidFrom", "counterId");
                  }}
                  columns="grid-cols-2"
                  row
                  invalid={!!problems.paidFrom}
                  describedBy={problems.paidFrom ? field("paid-msg") : undefined}
                />
              </div>
              <Problem id={field("paid-msg")} text={say(problems.paidFrom)} />
              {needsCounter && (
                <div className="mt-comfortable">
                  <Label htmlFor={field("counter")}>{t("drawer.counter")}</Label>
                  {counters.length === 0 ? (
                    <p className="mt-inline text-[13px] text-muted">{t("drawer.noCounters")}</p>
                  ) : (
                    <>
                      <Select
                        id={field("counter")}
                        className="mt-inline"
                        value={form.counterId}
                        placeholder={t("drawer.chooseCounter")}
                        onChange={(v) => {
                          patch({ counterId: v });
                          clear("counterId");
                        }}
                        options={counters.map((c) => ({ value: c.id, label: c.name, note: c.status === "active" ? undefined : t("drawer.counterClosed") }))}
                        aria-invalid={!!problems.counterId}
                        aria-describedby={problems.counterId ? field("counter-msg") : undefined}
                      />
                      <Problem id={field("counter-msg")} text={say(problems.counterId)} />
                    </>
                  )}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor={field("payee")}>{t("drawer.payee")}</Label>
              <input
                id={field("payee")}
                value={form.payee}
                maxLength={80}
                autoComplete="off"
                placeholder={t("drawer.payeePlaceholder")}
                onChange={(e) => patch({ payee: e.target.value })}
                className={cn(input, "mt-inline", edge(false))}
              />
              {(() => {
                const typed = form.payee.trim().toLowerCase();
                const near = payees.filter((p) => p.toLowerCase() !== typed && p.toLowerCase().startsWith(typed)).slice(0, 4);
                return near.length > 0 ? (
                  <div className="mt-tight flex flex-wrap items-center gap-tight" role="group" aria-label={t("drawer.recentPayees")}>
                    {near.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => patch({ payee: p })}
                        className="h-11 max-w-full truncate rounded-full border border-line bg-card px-comfortable text-[13px] text-fg transition-colors duration-quick hover:border-inverse sm:h-8"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
            </div>

            <div>
              <Label htmlFor={field("note")}>{t("drawer.note")}</Label>
              <textarea
                id={field("note")}
                rows={2}
                value={form.note}
                maxLength={500}
                placeholder={t("drawer.notePlaceholder")}
                onChange={(e) => patch({ note: e.target.value })}
                className={cn(input, "mt-inline h-auto resize-y py-tight", edge(false))}
              />
            </div>

            <div>
              <Label>{t("drawer.receipt")}</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label={t("drawer.receiptPick")}
                onChange={(e) => {
                  pickReceipt(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {form.receiptUrl ? (
                <div className="mt-inline">
                  <div className="flex items-center gap-comfortable">
                    <button
                      type="button"
                      onClick={() => setReceiptBig((v) => !v)}
                      aria-expanded={receiptBig}
                      aria-label={t(receiptBig ? "drawer.receiptSmaller" : "drawer.receiptLarger")}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-line bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.receiptUrl} alt={t("drawer.receiptAlt")} className="h-full w-full object-cover" />
                    </button>
                    <div className="flex flex-wrap items-center gap-tight">
                      <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                        {t("drawer.receiptReplace")}
                      </Button>
                      <Button variant="tertiary" size="sm" onClick={dropReceipt}>
                        {t("drawer.receiptRemove")}
                      </Button>
                    </div>
                  </div>
                  {receiptBig && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.receiptUrl} alt={t("drawer.receiptAlt")} className="mt-tight max-h-80 w-full rounded-md border border-line bg-subtle object-contain" />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-inline flex min-h-[72px] w-full items-center justify-center gap-tight rounded-md border border-dashed border-strong text-[13px] text-muted outline-none transition-colors duration-quick hover:border-inverse hover:text-fg focus-visible:ring-2 focus-visible:ring-ink"
                >
                  <ImagePlus size={20} strokeWidth={1.5} aria-hidden />
                  {t("drawer.receiptAdd")}
                </button>
              )}
            </div>

            <p className="text-[12px] text-muted">
              {editing && expense
                ? t("drawer.addedBy", { name: expense.recordedByName, date: formatDay(expense.createdAt.slice(0, 10)) })
                : t("drawer.willBeAddedBy", { name: me })}
            </p>
          </form>
        </div>
      </Sheet>

      <Modal
        open={confirming}
        onClose={keepEditing}
        title={t("discard.title")}
        description={t("discard.text")}
        size="sm"
        footer={
          <>
            <Button data-autofocus variant="secondary" onClick={keepEditing}>
              {t("discard.keep")}
            </Button>
            <Button variant="destructive" onClick={finish}>
              {t("discard.discard")}
            </Button>
          </>
        }
      />
    </>
  );
}

