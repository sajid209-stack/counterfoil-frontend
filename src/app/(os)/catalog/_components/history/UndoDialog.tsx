"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, Modal, Sheet, useToast } from "@/components/ui";
import { revertCatalogChanges, updateProduct, type CatalogRevision, type Product } from "@/lib/api";
import { MD, useMediaQuery } from "@/lib/useMedia";
import { Value, useHistoryWords } from "./HistoryValues";
import { previewUndo, type Session } from "./sessions";

/**
 * Undo, previewed. It lists every field with `now → will be`, says when a field
 * has changed again since, and names what it will not put back. Confirming
 * makes one save, which then shows up as its own entry.
 *
 * A Modal from md, a bottom Sheet on a phone (the kit Sheet leaves its body's
 * padding to the caller).
 */
export function UndoDialog({
  session,
  revisions,
  product,
  currency,
  onClose,
  onDone,
}: {
  session: Session;
  revisions: CatalogRevision[];
  product: Product;
  currency: string;
  onClose: () => void;
  /** After the save: reload the history and hand the new booking to the record. */
  onDone: (next: Product) => void;
}) {
  const t = useTranslations("catalog.history");
  const tc = useTranslations("common");
  const toast = useToast();
  const wide = useMediaQuery(MD);
  const { fieldLabel } = useHistoryWords(currency);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => previewUndo(session, revisions), [session, revisions]);

  const confirm = async () => {
    setBusy(true);
    const res = await revertCatalogChanges(product, preview.rows.map((r) => r.change), session.at, updateProduct);
    setBusy(false);
    if (res.ok) {
      toast.success(t("undo.done"));
      onDone(res.data);
      onClose();
    } else {
      toast.error(res.error.message);
    }
  };

  const body = (
    <div className="flex flex-col gap-section">
      {preview.rows.length > 0 ? (
        <>
          <p className="text-base text-fg">{t("undo.intro")}</p>
          <ul className="flex flex-col divide-y divide-hairline rounded-inner border border-hairline">
            {preview.rows.map((r) => (
              <li key={`${r.change.field}|${r.change.subject?.id ?? ""}`} className="flex flex-col gap-inline px-comfortable py-tight md:grid md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:gap-comfortable">
                <span className="text-sm text-muted">{fieldLabel(r.change)}</span>
                <span className="flex min-w-0 flex-col gap-inline">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-tight gap-y-inline text-sm">
                    <span className="sr-only">{t("undo.now")}</span>
                    <Value v={r.current} c={r.change} currency={currency} />
                    <ArrowRight aria-hidden size={14} strokeWidth={1.5} className="shrink-0 text-muted" />
                    <span className="sr-only">{t("undo.willBe")}</span>
                    <Value v={r.change.before} c={r.change} currency={currency} strong />
                  </span>
                  {r.again && <span className="text-xs text-muted">{t("undo.again")}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-base text-fg">{t("undo.nothing")}</p>
      )}
      {preview.notUndone.length > 0 && (
        <section aria-labelledby="undo-not-undone" className="flex flex-col gap-inline">
          <h3 id="undo-not-undone" className="text-sm font-semibold text-fg">
            {t("undo.notUndone")}
          </h3>
          <ul className="flex flex-col gap-inline text-sm text-muted">
            {preview.notUndone.map((c) => (
              <li key={`${c.field}|${c.subject?.id ?? ""}`}>{fieldLabel(c)}</li>
            ))}
          </ul>
          <p className="text-sm text-muted">{t("undo.notUndoneBody")}</p>
        </section>
      )}
    </div>
  );

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={busy}>
        {tc("cancel")}
      </Button>
      <Button onClick={confirm} loading={busy} disabled={preview.rows.length === 0}>
        {t("undo.confirm")}
      </Button>
    </>
  );

  return wide ? (
    <Modal open onClose={onClose} title={t("undo.title")} size="lg" footer={footer}>
      {body}
    </Modal>
  ) : (
    <Sheet open onClose={onClose} title={t("undo.title")} closeLabel={tc("close")} footer={<div className="flex w-full gap-tight [&>*]:flex-1">{footer}</div>}>
      <div className="px-gutter py-section">{body}</div>
    </Sheet>
  );
}
