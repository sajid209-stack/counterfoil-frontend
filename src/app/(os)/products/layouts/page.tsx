"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Grid3x3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { createSeatLayout, listSeatLayouts } from "@/lib/api";

export default function SeatLayoutsPage() {
  const t = useTranslations("seatmaps");
  const router = useRouter();
  const toast = useToast();
  const q = useApiQuery(() => listSeatLayouts({ pageSize: 100 }), []);
  const [creating, setCreating] = useState(false);
  const layouts = q.data?.data ?? [];

  const create = async () => {
    setCreating(true);
    const res = await createSeatLayout({ name: "New layout", locationId: null, rows: 6, seatsPerRow: 10, rowLabels: ["A", "B", "C", "D", "E", "F"], bufferAfterMinutes: 15 });
    setCreating(false);
    if (res.ok) { toast.success(t("list.created")); router.push(`/products/layouts/${res.data.id}`); }
    else toast.error(res.error.message);
  };

  return (
    <PageShell
      title={t("list.title")}
      description={t("list.description")}
      actions={<Button icon={<Plus size={16} strokeWidth={1.5} />} loading={creating} onClick={create}>{t("list.new")}</Button>}
    >
      {q.loading ? (
        <div aria-busy="true" className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-md bg-line" />)}
        </div>
      ) : layouts.length === 0 ? (
        <EmptyState title={t("list.empty")} action={<Button onClick={create}>{t("list.new")}</Button>} />
      ) : (
        <div className="grid gap-tight sm:grid-cols-2 lg:grid-cols-3">
          {layouts.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => router.push(`/products/layouts/${l.id}`)}
              className="flex flex-col gap-tight card-surface p-section text-left transition-colors duration-quick hover:border-ember/40 active:bg-ember/10"
            >
              <div className="flex items-center gap-tight">
                <Grid3x3 size={18} strokeWidth={1.5} className="text-faint" />
                <span className="min-w-0 truncate font-medium">{l.name}</span>
              </div>
              <span className="font-mono text-[12px] text-muted">{l.rows}×{l.seatsPerRow} · {l.seatCount} {t("list.seats")}</span>
              <div className="mt-inline flex flex-wrap gap-inline">
                {l.categories.map((c) => (
                  <span key={c.uid} className="inline-flex items-center gap-inline rounded-xs px-inline py-[2px] text-[11px]" style={{ background: `${c.color}22`, color: c.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />{c.name}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
