"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createCategory, listCategories, listProducts, updateCategory, type Category } from "@/lib/api";
import { SectionSkeleton, SettingsSection, controlCls } from "../_components/SettingsKit";

const iconBtn =
  "inline-flex h-11 w-11 items-center justify-center rounded-sm text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg disabled:pointer-events-none disabled:opacity-40 md:h-9 md:w-9";

/**
 * Categories — the chips a cashier taps to narrow the till.
 *
 * Order is the point of the reordering controls, not decoration: sortOrder is
 * the order the chips appear at the counter, and the busiest group belongs
 * first because it is the one tapped all day. So the list that can be reordered
 * is headed with exactly that, and retired categories sit apart below it rather
 * than mixed into the order they no longer take part in.
 *
 * There is no delete. A category with bookings in it cannot be removed without
 * orphaning them, and the entity has no delete in the API for that reason —
 * retiring hides its chip and leaves its bookings alone. Renaming saves when
 * the field is left, as an inline edit should.
 */
export default function CategoriesPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const [reload, setReload] = useState(0);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), [reload]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 500 }), [reload]);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const all = [...(catsQ.data?.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = all.filter((c) => c.active);
  const retired = all.filter((c) => !c.active);
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
    toast.success(t("categories.renamed", { name }));
    refresh();
  };

  const setActive = async (c: Category, on: boolean) => {
    const res = await updateCategory(c.id, { active: on });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(on ? t("categories.restored", { name: c.name }) : t("categories.retired", { name: c.name }));
    refresh();
  };

  /** Swap with the neighbour — two writes, because order belongs to both rows. */
  const move = async (index: number, dir: -1 | 1) => {
    const a = active[index];
    const b = active[index + dir];
    if (!a || !b) return;
    setBusy(true);
    const r1 = await updateCategory(a.id, { sortOrder: b.sortOrder });
    const r2 = await updateCategory(b.id, { sortOrder: a.sortOrder });
    setBusy(false);
    if (!r1.ok || !r2.ok) toast.error(t("categories.reorderFailed"));
    refresh();
  };

  if (catsQ.loading && !catsQ.data) {
    return (
      <PageShell title={t("categories.title")} description={t("categories.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell title={t("categories.title")} description={t("categories.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("categories.activeTitle")} description={t("categories.activeDesc")}>
          {active.length === 0 ? (
            <p className="px-major py-section text-sm text-muted">{t("categories.emptyMessage")}</p>
          ) : (
            <ol className="divide-y divide-hairline">
              {active.map((c, i) => (
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
                      disabled={i === active.length - 1 || busy}
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
                    // Reads as the name until it is pointed at: a white box per row made
                    // the list look like a stack of empty form fields.
                    className={`${controlCls().replace("border-line", "border-transparent hover:border-line").replace("bg-card", "bg-transparent focus:bg-card")} min-w-0 flex-1`}
                  />
                  <span className="hidden shrink-0 whitespace-nowrap text-[13px] text-muted sm:inline">
                    {t("categories.count", { count: countIn(c.id) })}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setActive(c, false)}>
                    {t("categories.retire")}
                  </Button>
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
              className={`${controlCls()} sm:flex-1`}
            />
            <Button onClick={add} disabled={!newName.trim() || busy} icon={<Plus size={16} strokeWidth={1.5} />}>
              {t("categories.add")}
            </Button>
          </div>
        </SettingsSection>

        {retired.length > 0 && (
          <SettingsSection title={t("categories.retiredTitle")} description={t("categories.retiredDesc")}>
            <ul className="divide-y divide-hairline">
              {retired.map((c) => (
                <li key={c.id} className="flex items-center gap-section px-section py-tight sm:px-major">
                  <span className="min-w-0 flex-1 text-sm text-fg">{c.name}</span>
                  <span className="hidden shrink-0 whitespace-nowrap text-[13px] text-muted sm:inline">
                    {t("categories.count", { count: countIn(c.id) })}
                  </span>
                  <Button variant="secondary" size="sm" onClick={() => setActive(c, true)}>
                    {t("categories.restore")}
                  </Button>
                </li>
              ))}
            </ul>
          </SettingsSection>
        )}
      </div>
    </PageShell>
  );
}
