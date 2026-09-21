"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button, PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { createCategory, listCategories, listProducts, updateCategory, type Category, type CategoryColor } from "@/lib/api";
import { SectionSkeleton, SettingsSection, Switch, controlCls } from "../_components/SettingsKit";
import { ColorPicker } from "./_components/ColorPicker";

const iconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9";

/**
 * Categories — the chips a cashier taps to narrow the till.
 *
 * Order is the point of the reordering controls, not decoration: sortOrder is
 * the order the chips appear at the counter, and the busiest group belongs
 * first because it is the one tapped all day.
 *
 * Retiring used to move a category into a second section below — so the row
 * someone had just acted on jumped away from under their pointer, and putting
 * it back meant finding it somewhere else. Each row now carries a "shown at the
 * till" switch and stays exactly where it is, dimmed when hidden, with Undo on
 * the confirmation.
 *
 * There is no delete. A category with bookings in it cannot be removed without
 * orphaning them, and the entity has no delete in the API for that reason —
 * hiding it takes its chip off the till and leaves its bookings alone.
 * Renaming saves when the field is left, as an inline edit should.
 */
export default function CategoriesPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const [reload, setReload] = useState(0);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), [reload]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), [reload]);
  const [latest, setLatest] = useState<Record<string, Category>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const all = [...(catsQ.data?.data ?? [])].map((c) => latest[c.id] ?? c).sort((a, b) => a.sortOrder - b.sortOrder);
  const products = productsQ.data?.data ?? [];
  const countIn = (id: string) => products.filter((p) => p.categoryId === id && p.status !== "archived").length;
  const refresh = () => setReload((n) => n + 1);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    // Appended, not inserted: a new group has not earned the front of the row.
    const res = await createCategory({ name, sortOrder: (all.at(-1)?.sortOrder ?? 0) + 1, active: true });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setNewName("");
    toast.success(t("categories.added", { name }));
    refresh();
  };

  const rename = async (c: Category, raw: string) => {
    const name = raw.trim();
    if (!name || name === c.name) return;
    const res = await updateCategory(c.id, { name });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [c.id]: res.data }));
    toast.success(t("categories.renamed", { name }));
  };

  /* The colour is what the calendar paints this category, so the control
     belongs where the category is named rather than on the calendar, which
     would be a setting hiding inside a view. */
  const setColor = async (c: Category, color: CategoryColor | null) => {
    const res = await updateCategory(c.id, { color });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [c.id]: res.data }));
    toast.success(
      color
        ? t("categories.colorSet", { name: c.name, color: t(`categories.colors.${color}`) })
        : t("categories.colorCleared", { name: c.name }),
    );
  };

  const setShown = async (c: Category, shown: boolean, undoable = true) => {
    const res = await updateCategory(c.id, { active: shown });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    setLatest((m) => ({ ...m, [c.id]: res.data }));
    if (!undoable) return;
    toast.success(shown ? t("categories.shownToast", { name: c.name }) : t("categories.hiddenToast", { name: c.name }), {
      label: t("common.undo"),
      run: () => setShown(res.data, !shown, false),
    });
  };

  /** Swap with the neighbour — two writes, because order belongs to both rows. */
  const move = async (index: number, dir: -1 | 1) => {
    const a = all[index];
    const b = all[index + dir];
    if (!a || !b) return;
    setBusy(true);
    const r1 = await updateCategory(a.id, { sortOrder: b.sortOrder });
    const r2 = await updateCategory(b.id, { sortOrder: a.sortOrder });
    setBusy(false);
    if (!r1.ok || !r2.ok) {
      toast.error(t("categories.reorderFailed"));
      return;
    }
    setLatest((m) => ({ ...m, [a.id]: r1.data, [b.id]: r2.data }));
  };

  if (!catsQ.data) {
    return (
      <PageShell title={t("categories.title")} description={t("categories.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("categories.title")} description={t("categories.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("categories.listTitle")} description={t("categories.listDesc")}>
          {all.length === 0 ? (
            <p className="px-major py-section text-sm text-muted">{t("categories.emptyMessage")}</p>
          ) : (
            <ol className="divide-y divide-hairline">
              {all.map((c, i) => (
                <li key={c.id} className="flex items-center gap-tight px-section py-tight sm:px-major">
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      aria-label={t("categories.moveUpNamed", { name: c.name })}
                      disabled={i === 0 || busy}
                      onClick={() => move(i, -1)}
                      className={iconBtn}
                    >
                      <ArrowUp size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={t("categories.moveDownNamed", { name: c.name })}
                      disabled={i === all.length - 1 || busy}
                      onClick={() => move(i, 1)}
                      className={iconBtn}
                    >
                      <ArrowDown size={16} strokeWidth={1.5} aria-hidden />
                    </button>
                  </div>
                  <input
                    key={`${c.id}-${c.name}`}
                    defaultValue={c.name}
                    aria-label={t("categories.renameNamed", { name: c.name })}
                    onBlur={(e) => rename(c, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    // Reads as the name until it is pointed at: a white box per
                    // row made the list look like a stack of empty form fields.
                    className={cn(
                      controlCls().replace("border-line", "border-transparent hover:border-line").replace("bg-card", "bg-transparent focus:bg-card"),
                      "min-w-0 flex-1",
                      c.active ? undefined : "text-muted",
                    )}
                  />
                  <span className="hidden shrink-0 whitespace-nowrap text-[13px] text-muted sm:inline">
                    {c.active ? t("categories.count", { count: countIn(c.id) }) : t("categories.hiddenTag")}
                  </span>
                  <ColorPicker
                    value={c.color}
                    onChange={(next) => setColor(c, next)}
                    label={t("categories.colorNamed", {
                      name: c.name,
                      color: c.color ? t(`categories.colors.${c.color}`) : t("categories.colors.none"),
                    })}
                    optionLabel={(color) => t(`categories.colors.${color}`)}
                    noneLabel={t("categories.colors.none")}
                  />
                  <Switch checked={c.active} onChange={(on) => setShown(c, on)} label={t("categories.showSwitch", { name: c.name })} />
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-col gap-tight px-section py-section sm:flex-row sm:items-center sm:px-major">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder={t("categories.newPlaceholder")}
              aria-label={t("categories.addLabel")}
              className={cn(controlCls(), "sm:flex-1")}
            />
            <Button onClick={add} disabled={!newName.trim() || busy} icon={<Plus size={16} strokeWidth={1.5} />}>
              {t("categories.add")}
            </Button>
          </div>
        </SettingsSection>
      </div>
    </PageShell>
  );
}
