"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button, EmptyState, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createCategory, listCategories, listProducts, updateCategory, type Category } from "@/lib/api";

/**
 * Categories — the chips a cashier taps to narrow the till.
 *
 * They already existed as an entity and as a dropdown on every booking, but
 * there was nowhere to MAKE one: the four seeded groups were the only four an
 * operator could ever file anything under. This is that missing screen.
 *
 * Order is the point of the reordering controls, not decoration — sortOrder is
 * the order the chips appear at the counter, and the busiest group belongs
 * first because it is the one being tapped all day.
 *
 * There is no delete. A category with bookings in it cannot be removed without
 * silently orphaning them, and the entity has no delete in the API for exactly
 * that reason — retiring one hides its chip and leaves its bookings alone.
 */
export default function CategoriesPage() {
  const t = useTranslations("settings");
  const toast = useToast();

  const [reload, setReload] = useState(0);
  const catsQ = useApiQuery(() => listCategories({ pageSize: 100 }), [reload]);
  const productsQ = useApiQuery(() => listProducts({ pageSize: 200 }), [reload]);

  const categories = [...(catsQ.data?.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const products = productsQ.data?.data ?? [];
  const countIn = (id: string) => products.filter((p) => p.categoryId === id).length;

  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => setReload((n) => n + 1);

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const res = await createCategory({
      name,
      // Appended, not inserted: a new group has not earned the front of the row.
      sortOrder: (categories.at(-1)?.sortOrder ?? 0) + 1,
      active: true,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    setNewName("");
    toast.success(t("categories.added", { name }));
    refresh();
  };

  const rename = async (c: Category, name: string) => {
    if (!name.trim() || name === c.name) return;
    const res = await updateCategory(c.id, { name: name.trim() });
    if (!res.ok) return toast.error(res.error.message);
    toast.success(t("common.changesSaved"));
    refresh();
  };

  const toggle = async (c: Category) => {
    const res = await updateCategory(c.id, { active: !c.active });
    if (!res.ok) return toast.error(res.error.message);
    toast.success(c.active ? t("categories.retired", { name: c.name }) : t("categories.restored", { name: c.name }));
    refresh();
  };

  /** Swap this row's order with its neighbour's — two writes, because order is
   *  a property of both rows and not of the gap between them. */
  const move = async (index: number, dir: -1 | 1) => {
    const a = categories[index];
    const b = categories[index + dir];
    if (!a || !b) return;
    setBusy(true);
    const r1 = await updateCategory(a.id, { sortOrder: b.sortOrder });
    const r2 = await updateCategory(b.id, { sortOrder: a.sortOrder });
    setBusy(false);
    if (!r1.ok || !r2.ok) return toast.error(t("categories.reorderFailed"));
    refresh();
  };

  const loading = catsQ.loading || productsQ.loading;

  return (
    <PageShell title={t("categories.title")} description={t("categories.description")}>
      <div className="flex max-w-3xl flex-col gap-section">
        <div className="card-surface overflow-hidden">
          {loading ? (
            <div aria-busy="true" className="h-64 animate-pulse bg-line/40" />
          ) : categories.length === 0 ? (
            <EmptyState title={t("categories.emptyTitle")} message={t("categories.emptyMessage")} />
          ) : (
            <ul>
              {categories.map((c, i) => {
                const n = countIn(c.id);
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-comfortable border-b border-line px-comfortable py-tight last:border-0"
                  >
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        aria-label={t("categories.moveUp")}
                        disabled={i === 0 || busy}
                        onClick={() => move(i, -1)}
                        className="flex h-5 w-6 items-center justify-center text-muted disabled:opacity-30 hover:text-fg"
                      >
                        <ArrowUp size={13} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("categories.moveDown")}
                        disabled={i === categories.length - 1 || busy}
                        onClick={() => move(i, 1)}
                        className="flex h-5 w-6 items-center justify-center text-muted disabled:opacity-30 hover:text-fg"
                      >
                        <ArrowDown size={13} strokeWidth={1.5} />
                      </button>
                    </div>

                    <input
                      defaultValue={c.name}
                      onBlur={(e) => rename(c, e.target.value)}
                      aria-label={t("categories.nameLabel")}
                      className="h-10 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-tight text-sm outline-none hover:border-line focus:border-inverse"
                    />

                    <span className="shrink-0 whitespace-nowrap font-mono text-[12px] text-muted">
                      {t("categories.count", { count: n })}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={`h-9 shrink-0 whitespace-nowrap rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
                        c.active
                          ? "border-line text-muted hover:bg-subtle"
                          : "border-ember bg-ember/10 text-brand-foreground"
                      }`}
                    >
                      {c.active ? t("categories.retire") : t("categories.restore")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-tight sm:flex-row sm:items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={t("categories.newPlaceholder")}
            aria-label={t("categories.newPlaceholder")}
            className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-card px-comfortable text-sm outline-none focus:border-inverse"
          />
          <Button onClick={add} disabled={!newName.trim() || busy} icon={<Plus size={16} strokeWidth={1.5} />}>
            {t("categories.add")}
          </Button>
        </div>

        <p className="text-[12px] text-muted">{t("categories.retireHelp")}</p>
      </div>
    </PageShell>
  );
}
