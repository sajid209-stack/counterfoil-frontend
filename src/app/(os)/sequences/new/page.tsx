"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, FilterSearch, useToast } from "@/components/ui";
import { PageShell } from "@/components/ui/PageShell";
import { createSequence } from "@/lib/api";
import { IDEA_GROUPS, SEQUENCE_IDEAS, emptyDraft, ideaDraft, type SeqT } from "@/lib/sequences";
import { IdeaCard } from "../_components/list/IdeaCard";

/**
 * Start from an idea (docs/sequences.md 5.2). Choosing one makes the sequence —
 * named, filled in and off — and opens it in the builder. "Start with nothing"
 * is a quiet card at the very end, never the default.
 */
export default function NewSequencePage() {
  const t = useTranslations("sequencesList");
  const ts = useTranslations("sequences");
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState("");
  /** The id being made ("none" for an empty one). While set, every card is disabled. */
  const [creating, setCreating] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const shown = SEQUENCE_IDEAS.filter((i) => !q || `${ts(`ideas.${i.id}.name`)} ${ts(`ideas.${i.id}.desc`)}`.toLowerCase().includes(q));

  const make = async (key: string, input: ReturnType<typeof emptyDraft> | null) => {
    if (creating || !input) return;
    setCreating(key);
    const res = await createSequence(input);
    if (!res.ok) {
      setCreating(null);
      toast.error(t("new.failed"));
      return;
    }
    router.push(`/sequences/${res.data.id}?new=1`);
  };

  return (
    <PageShell title={t("new.title")} description={t("new.description")} back={{ href: "/sequences", label: t("new.back") }}>
      <div className="flex flex-col gap-major">
        <FilterSearch value={search} onChange={setSearch} placeholder={t("new.search")} aria-label={t("new.search")} className="md:max-w-sm" />

        {shown.length === 0 ? (
          <EmptyState
            title={t("new.noMatchTitle")}
            message={t("new.noMatchBody")}
            action={
              <Button variant="secondary" onClick={() => setSearch("")}>
                {t("new.showAll")}
              </Button>
            }
          />
        ) : (
          IDEA_GROUPS.map((g) => {
            const ideas = shown.filter((i) => i.group === g);
            if (ideas.length === 0) return null;
            return (
              <section key={g} aria-labelledby={`idea-group-${g}`} className="flex flex-col gap-comfortable">
                <h2 id={`idea-group-${g}`} className="text-md font-semibold text-fg">
                  {ts(`ideas.group.${g}`)}
                </h2>
                <div className="grid gap-section sm:grid-cols-2 xl:grid-cols-3">
                  {ideas.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} disabled={!!creating} busy={creating === idea.id} onChoose={(id) => make(id, ideaDraft(ts as unknown as SeqT, id))} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <button
          type="button"
          disabled={!!creating}
          aria-busy={creating === "none" || undefined}
          onClick={() => make("none", { ...emptyDraft(), name: "" })}
          className="flex w-full flex-col gap-inline rounded-card border border-dashed border-line p-card text-left transition-colors duration-quick hover:border-strong hover:bg-subtle disabled:opacity-60"
        >
          <span className="text-base font-semibold text-fg">{t("new.noneTitle")}</span>
          <span className="text-sm text-muted">{t("new.noneBody")}</span>
        </button>
      </div>
    </PageShell>
  );
}
