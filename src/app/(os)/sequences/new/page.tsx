"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Notice, Skeleton } from "@/components/ui";
import { PageShell } from "@/components/ui/PageShell";
import { createSequence } from "@/lib/api";
import { emptyDraft } from "@/lib/sequences";

/**
 * New sequence. No ideas and no ready-made steps: it makes an empty sequence
 * and opens it, where the first question is "When should it start?".
 */
export default function NewSequencePage() {
  const t = useTranslations("sequencesList");
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  const make = async () => {
    const res = await createSequence(emptyDraft());
    if (!res.ok) {
      setFailed(true);
      return;
    }
    router.replace(`/sequences/${res.data.id}?new=1`);
  };

  useEffect(() => {
    // Strict mode runs effects twice in development; make one sequence, not two.
    if (started.current) return;
    started.current = true;
    void make();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageShell title={t("new.title")} back={{ href: "/sequences", label: t("new.back") }}>
      {failed ? (
        <Notice
          tone="danger"
          action={{
            label: t("new.retry"),
            onClick: () => {
              setFailed(false);
              void make();
            },
          }}
        >
          {t("new.failed")}
        </Notice>
      ) : (
        <div aria-busy="true" className="mx-auto flex w-full max-w-2xl flex-col gap-section">
          <Skeleton h={44} />
          <Skeleton h={120} />
          <Skeleton h={120} />
        </div>
      )}
    </PageShell>
  );
}
