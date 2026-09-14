"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, RotateCcw } from "lucide-react";
import { PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import { getOperator, updateOperator } from "@/lib/api";
import { DEFAULT_SMS_TEMPLATE, SMS_PLACEHOLDERS, renderSms } from "@/lib/sms";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay } from "@/lib/format";
import { SaveBar, SectionSkeleton, SettingRow, SettingsSection } from "../_components/SettingsKit";

/* The GSM 03.38 alphabet an SMS can carry at 160 characters a message. The
   extension characters each take two of those 160; anything outside both —
   Bangla, an emoji, a typographer's curly apostrophe — switches the whole
   message to UCS-2 at 70 per SMS. */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENSION = "^{}\\[~]|€";

/**
 * What a message costs to send.
 *
 * An operator pays per SMS, and a template that reads fine can quietly be two
 * of them — or, with one Bangla word in it, three. Counted on the message as
 * it is actually sent (placeholders filled in), not on the template, because
 * "{business}" is ten characters and "Lalbagh Heritage Attractions" is
 * twenty-eight.
 */
function smsCost(text: string): { chars: number; segments: number; unicode: boolean } {
  let units = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) units += 1;
    else if (GSM_EXTENSION.includes(ch)) units += 2;
    else {
      const n = text.length; // UCS-2 counts UTF-16 code units
      return { chars: n, segments: n <= 70 ? 1 : Math.ceil(n / 67), unicode: true };
    }
  }
  return { chars: units, segments: units <= 160 ? 1 : Math.ceil(units / 153), unicode: false };
}

/** A sample code, so the preview's length is the length a real message has. */
const SAMPLE_CODE = "CF-2026-000123-01";

/**
 * Ticket messages — the SMS a customer is sent with their ticket.
 *
 * It was a textarea at the bottom of Business setup, with the placeholders
 * listed underneath as grey chips that did nothing when pressed. Now pressing a
 * placeholder puts it where the cursor is, the preview is drawn as the message
 * a phone shows, and the page says how many SMS it will be billed as.
 */
export default function TicketMessagesPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const opQ = useApiQuery(() => getOperator(), []);
  const field = useRef<HTMLTextAreaElement>(null);

  const [base, setBase] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = base ?? (opQ.data ? opQ.data.smsTemplate ?? DEFAULT_SMS_TEMPLATE : null);
  const template = draft ?? saved;
  const dirty = draft !== null && saved !== null && draft !== saved;
  const emptyErr = template !== null && !template.trim() ? t("notifications.empty") : undefined;

  const insert = (token: string) => {
    if (template === null) return;
    const el = field.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    setDraft(template.slice(0, start) + token + template.slice(end));
    // The caret goes after what was inserted — where the next keystroke belongs.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (template === null || emptyErr) return;
    setSaving(true);
    const res = await updateOperator({ smsTemplate: template });
    setSaving(false);
    if (res.ok) {
      setBase(res.data.smsTemplate ?? DEFAULT_SMS_TEMPLATE);
      setDraft(null);
      toast.success(t("notifications.saved"));
    } else {
      toast.error(res.error.message);
    }
  };

  const preview =
    template === null
      ? ""
      : renderSms(template, { business: opQ.data?.name ?? "", code: SAMPLE_CODE, date: formatDay(DEMO_TODAY, { weekday: true }) });
  const cost = smsCost(preview);

  return (
    <PageShell title={t("notifications.title")} description={t("notifications.description")}>
      {template === null ? (
        <SectionSkeleton />
      ) : (
        <div className="flex max-w-3xl flex-col gap-section pb-hero">
          <SettingsSection
            title={t("notifications.smsTitle")}
            description={t("notifications.smsDesc")}
            aside={
              template !== DEFAULT_SMS_TEMPLATE ? (
                <button
                  type="button"
                  onClick={() => setDraft(DEFAULT_SMS_TEMPLATE)}
                  className="inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
                >
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
                  {t("notifications.reset")}
                </button>
              ) : undefined
            }
          >
            <SettingRow label={t("notifications.message")} description={t("notifications.messageDesc")} layout="stack" error={emptyErr}>
              {({ id, describedBy }) => (
                <div className="flex flex-col gap-tight">
                  <textarea
                    ref={field}
                    id={id}
                    rows={4}
                    value={template}
                    onChange={(e) => setDraft(e.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={!!emptyErr || undefined}
                    className={cn(
                      "w-full min-w-0 resize-y rounded-sm border bg-card px-comfortable py-tight text-sm leading-relaxed text-fg outline-none transition-colors duration-quick",
                      emptyErr ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
                    )}
                  />
                  <div className="flex flex-wrap gap-tight">
                    {SMS_PLACEHOLDERS.map((p) => {
                      const name = p.key.slice(1, -1);
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => insert(p.key)}
                          aria-label={t("notifications.insert", { placeholder: p.key })}
                          className="inline-flex min-h-11 items-center gap-tight rounded-sm border border-line bg-card px-comfortable text-[13px] transition-colors duration-quick hover:border-ember/40 md:min-h-9"
                        >
                          <Plus size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
                          <code className="font-mono text-[12px] text-fg">{p.key}</code>
                          <span className="text-muted">{t(`notifications.ph.${name}`)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </SettingRow>

            <SettingRow label={t("notifications.preview")} description={t("notifications.previewDesc")} layout="stack" labelFor={false}>
              {() => (
                <div className="flex flex-col gap-tight">
                  {/* Drawn as the message bubble a phone shows, because that
                      is the only place a customer ever reads it. */}
                  <p className="max-w-sm whitespace-pre-wrap break-words rounded-lg rounded-bl-xs bg-subtle px-section py-comfortable text-sm leading-relaxed text-fg">
                    {preview}
                  </p>
                  <p className="text-[12px] text-muted">
                    {t("notifications.length", { count: cost.chars })} · {t("notifications.segments", { count: cost.segments })}
                  </p>
                  {cost.unicode && <p className="max-w-prose text-[12px] text-muted">{t("notifications.unicode")}</p>}
                </div>
              )}
            </SettingRow>
          </SettingsSection>

          <SaveBar dirty={dirty} saving={saving} invalid={!!emptyErr} onSave={save} onDiscard={() => setDraft(null)} />
        </div>
      )}
    </PageShell>
  );
}
