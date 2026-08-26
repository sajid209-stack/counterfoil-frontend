"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { generateSeats, getSeatLayout, saveLayoutPlan, updateSeatLayout } from "@/lib/api";
import type { LayoutSeat, SeatCategory } from "@/lib/api";

const PALETTE = ["#F94A00", "#2563EB", "#16A34A", "#7C3AED", "#D97706", "#DC2626"];
type Tool = { kind: "assign"; categoryUid: string } | { kind: "block" } | { kind: "clear" };

export default function SeatLayoutEditorPage() {
  const t = useTranslations("seatmaps");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => getSeatLayout(params.id), [params.id]);

  const [name, setName] = useState("");
  const [buffer, setBuffer] = useState(15);
  const [rows, setRows] = useState(6);
  const [perRow, setPerRow] = useState(10);
  const [categories, setCategories] = useState<SeatCategory[]>([]);
  const [seats, setSeats] = useState<LayoutSeat[]>([]);
  const [tool, setTool] = useState<Tool>({ kind: "assign", categoryUid: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setName(q.data.name); setBuffer(q.data.bufferAfterMinutes);
    setRows(q.data.rows); setPerRow(q.data.seatsPerRow);
    setCategories(q.data.categories); setSeats(q.data.seats);
    setTool(q.data.categories[0] ? { kind: "assign", categoryUid: q.data.categories[0].uid } : { kind: "clear" });
  }, [q.data]);

  if (!q.loading && (q.error || !q.data)) {
    return <PageShell title={t("editor.backToList")}><EmptyState title="Not found" action={<Button onClick={() => router.push("/products/layouts")}>{t("editor.backToList")}</Button>} /></PageShell>;
  }

  const catOf = (uid: string | null) => categories.find((c) => c.uid === uid);
  const applyTool = (seatId: string) => {
    setSeats((ss) => ss.map((s) => {
      if (s.id !== seatId) return s;
      if (tool.kind === "assign") return { ...s, seatCategoryId: tool.categoryUid, isAvailable: true };
      if (tool.kind === "block") return { ...s, isAvailable: !s.isAvailable };
      return { ...s, seatCategoryId: null, isAvailable: true }; // clear
    }));
  };

  const addCategory = () => {
    const uid = `cat_${globalThis.crypto.randomUUID().slice(0, 6)}`;
    const color = PALETTE[categories.length % PALETTE.length];
    setCategories((cs) => [...cs, { uid, name: "New category", color, price: 0, pricingMode: "fixed", isGeneralAdmission: false }]);
    setTool({ kind: "assign", categoryUid: uid });
  };
  const patchCategory = (uid: string, patch: Partial<SeatCategory>) =>
    setCategories((cs) => cs.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  const removeCategory = (uid: string) => {
    setCategories((cs) => cs.filter((c) => c.uid !== uid));
    setSeats((ss) => ss.map((s) => (s.seatCategoryId === uid ? { ...s, seatCategoryId: null } : s)));
  };

  const regenerate = () => {
    if (!confirm(t("editor.regenerateWarning"))) return;
    setSeats(generateSeats(rows, perRow));
  };

  const save = async () => {
    setSaving(true);
    await updateSeatLayout(params.id, { name, bufferAfterMinutes: buffer, rows, seatsPerRow: perRow });
    const res = await saveLayoutPlan(params.id, seats, categories);
    setSaving(false);
    if (res.ok) { toast.success(t("editor.saved")); q.reload(); }
    else toast.error(res.error.message);
  };

  const forSale = seats.filter((s) => s.seatCategoryId).length;
  const cols = perRow;

  return (
    <PageShell
      title={name || t("editor.backToList")}
      actions={<Button loading={saving} onClick={save}>{t("editor.save")}</Button>}
    >
      <button type="button" onClick={() => router.push("/products/layouts")} className="mb-section flex items-center gap-inline text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("editor.backToList")}
      </button>

      <div className="flex flex-col gap-major">
        {/* Meta */}
        <div className="grid gap-section rounded-md border border-line bg-card p-major sm:grid-cols-4">
          <FormField label={t("editor.name")} value={name} onChange={(e) => setName(e.target.value)} />
          <FormField label={t("editor.rows")} variant="number" value={String(rows)} onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))} />
          <FormField label={t("editor.seatsPerRow")} variant="number" value={String(perRow)} onChange={(e) => setPerRow(Math.max(1, parseInt(e.target.value) || 1))} />
          <FormField label={t("editor.buffer")} variant="number" value={String(buffer)} onChange={(e) => setBuffer(Math.max(0, parseInt(e.target.value) || 0))} />
          <div className="sm:col-span-4">
            <Button size="sm" variant="secondary" onClick={regenerate}>{t("editor.regenerate")}</Button>
          </div>
        </div>

        {/* Categories */}
        <div className="rounded-md border border-line bg-card p-major">
          <div className="mb-section flex items-center justify-between">
            <h2 className="type-h2 text-base">{t("editor.categoriesTitle")}</h2>
            <Button size="sm" icon={<Plus size={14} strokeWidth={1.5} />} onClick={addCategory}>{t("editor.addCategory")}</Button>
          </div>
          <div className="flex flex-col gap-tight">
            {categories.map((c) => (
              <div key={c.uid} className="flex flex-wrap items-end gap-tight rounded-sm border border-line p-tight">
                <input type="color" aria-label={t("editor.catColor")} value={c.color} onChange={(e) => patchCategory(c.uid, { color: e.target.value })} className="h-11 w-11 shrink-0 rounded-sm border border-line bg-card" />
                <div className="min-w-32 flex-1"><FormField label={t("editor.catName")} value={c.name} onChange={(e) => patchCategory(c.uid, { name: e.target.value })} /></div>
                <div className="w-28"><FormField label={t("editor.catPrice")} variant="number" value={String(c.price / 100)} onChange={(e) => patchCategory(c.uid, { price: Math.round((parseFloat(e.target.value) || 0) * 100) })} /></div>
                <label className="flex h-11 items-center gap-inline whitespace-nowrap text-[13px]">
                  <input type="checkbox" checked={c.isGeneralAdmission} onChange={(e) => patchCategory(c.uid, { isGeneralAdmission: e.target.checked })} className="h-4 w-4 accent-ember" />
                  {t("editor.catGa")}
                </label>
                <button type="button" aria-label={t("editor.removeCategory")} onClick={() => removeCategory(c.uid)} className="flex h-11 w-11 items-center justify-center rounded-sm border border-line text-danger active:bg-ember/10"><Trash2 size={15} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Seat grid */}
        <div className="rounded-md border border-line bg-card p-major">
          <div className="mb-tight flex items-center justify-between">
            <h2 className="type-h2 text-base">{t("editor.gridTitle")}</h2>
            <span className="font-mono text-[12px] text-muted">{t("editor.seatsForSale", { count: forSale })}</span>
          </div>
          <p className="mb-section text-[12px] text-faint">{t("editor.gridHelp")}</p>

          {/* Tool selector */}
          <div className="mb-section flex flex-wrap gap-inline">
            {categories.map((c) => {
              const on = tool.kind === "assign" && tool.categoryUid === c.uid;
              return (
                <button key={c.uid} type="button" onClick={() => setTool({ kind: "assign", categoryUid: c.uid })} className={`flex h-10 items-center gap-inline rounded-sm border px-comfortable text-[13px] ${on ? "border-inverse" : "border-line"}`} style={on ? { boxShadow: `inset 0 0 0 1px ${c.color}` } : undefined}>
                  <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />{c.name || t("editor.toolAssign")}
                </button>
              );
            })}
            <button type="button" onClick={() => setTool({ kind: "block" })} className={`h-10 rounded-sm border px-comfortable text-[13px] ${tool.kind === "block" ? "border-inverse bg-inverse text-inverse-fg" : "border-line"}`}>{t("editor.toolBlock")}</button>
            <button type="button" onClick={() => setTool({ kind: "clear" })} className={`h-10 rounded-sm border px-comfortable text-[13px] ${tool.kind === "clear" ? "border-inverse bg-inverse text-inverse-fg" : "border-line"}`}>{t("editor.toolClear")}</button>
          </div>

          {/* Screen marker + grid (scrolls horizontally if wide) */}
          <div className="mb-tight rounded-xs bg-subtle py-inline text-center font-mono text-[11px] tracking-widest text-faint">{t("editor.screen")}</div>
          <div className="overflow-x-auto">
            <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, 1.75rem)` }}>
              {seats.slice().sort((a, b) => a.posY - b.posY || a.posX - b.posX).map((s) => {
                const c = catOf(s.seatCategoryId);
                const blocked = !!s.seatCategoryId && !s.isAvailable;
                const style = c && s.isAvailable ? { background: `${c.color}33`, color: c.color, borderColor: c.color } : undefined;
                return (
                  <button
                    key={s.id}
                    type="button"
                    title={s.name}
                    onClick={() => applyTool(s.id)}
                    className={`h-7 rounded-[3px] border text-[9px] font-mono leading-none ${c ? "" : "border-dashed border-line text-faint"} ${blocked ? "border-line bg-line text-faint line-through" : ""}`}
                    style={blocked ? undefined : style}
                  >
                    {s.seatNumber}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-section flex flex-wrap gap-major text-[11px] text-muted">
            <span className="flex items-center gap-inline"><span className="h-3 w-3 rounded-[2px] border border-dashed border-line" />{t("editor.legendNotForSale")}</span>
            <span className="flex items-center gap-inline"><span className="h-3 w-3 rounded-[2px] bg-line" />{t("editor.legendBlocked")}</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
