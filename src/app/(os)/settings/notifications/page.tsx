"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Plus, RotateCcw } from "lucide-react";
import { PageShell, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useApiQuery } from "@/lib/useApi";
import {
  getNotificationSettings,
  getOperator,
  listRoles,
  updateNotificationSettings,
  updateOperator,
  type CustomerNotificationEvent,
  type NotificationChannel,
  type NotificationSettings,
  type StaffNotificationEvent,
} from "@/lib/api";
import { DEFAULT_SMS_TEMPLATE, SMS_PLACEHOLDERS, renderSms } from "@/lib/sms";
import { DEFAULT_EMAIL_BODY, DEFAULT_EMAIL_SUBJECT, EMAIL_PLACEHOLDERS, SUBJECT_VISIBLE } from "@/lib/email";
import { DEMO_TODAY } from "@/lib/schedule";
import { formatClock, formatDay, formatMoney } from "@/lib/format";
import {
  SaveBar,
  SectionSkeleton,
  SettingRow,
  SettingsSection,
  SuffixInput,
  Switch,
  controlCls,
} from "../_components/SettingsKit";
import { TimeField } from "../_components/TimeField";

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
/** And the order it belongs to, for the e-mail's subject line. */
const SAMPLE_REFERENCE = "CF-2026-000123";

const CUSTOMER_EVENTS: CustomerNotificationEvent[] = ["confirmation", "reminder", "rescheduled", "cancelled", "refunded", "followUp"];
const CHANNELS: NotificationChannel[] = ["sms", "email"];
const STAFF_EVENTS: StaffNotificationEvent[] = ["soldOut", "cashVariance", "deviceOffline", "largeRefund", "dailySummary"];

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/** Alphanumeric sender IDs: networks reject spaces, symbols and anything past 11. */
const SENDER = /^[A-Za-z0-9]{3,11}$/;
const REMINDER_RANGE = { min: 1, max: 168 };
const FOLLOW_UP_RANGE = { min: 1, max: 72 };

/** The page's draft: the stored settings with numbers held as typed, plus the ticket wording. */
interface Form extends Omit<NotificationSettings, "reminderHours" | "followUpHours" | "replyToEmail"> {
  reminderHours: string;
  followUpHours: string;
  replyToEmail: string;
  template: string;
  emailSubject: string;
  emailBody: string;
}

const toForm = (s: NotificationSettings, template: string, emailSubject: string, emailBody: string): Form => ({
  ...s,
  reminderHours: String(s.reminderHours),
  followUpHours: String(s.followUpHours),
  replyToEmail: s.replyToEmail ?? "",
  template,
  emailSubject,
  emailBody,
});

const fromForm = (f: Form): NotificationSettings => ({
  customer: f.customer,
  reminderHours: Number(f.reminderHours),
  followUpHours: Number(f.followUpHours),
  quietHours: f.quietHours,
  senderName: f.senderName.trim(),
  replyToEmail: f.replyToEmail.trim() || null,
  staff: f.staff,
});

/** What the operator has written, or the default they can reset to. */
const wording = (op: { smsTemplate?: string; emailSubject?: string; emailTemplate?: string } | null | undefined) => ({
  template: op?.smsTemplate ?? DEFAULT_SMS_TEMPLATE,
  emailSubject: op?.emailSubject ?? DEFAULT_EMAIL_SUBJECT,
  emailBody: op?.emailTemplate ?? DEFAULT_EMAIL_BODY,
});

/**
 * The words a message can carry, as chips under its field.
 *
 * One component for the SMS, the e-mail subject and the e-mail message: three
 * copies of this markup were three places for a chip to be named wrong, and each
 * chip's name has to say WHICH field it fills ("Add {business} to the e-mail
 * subject"), or three identical buttons read out as three identical buttons.
 * Quiet fills rather than outlined buttons: sixteen bordered chips on one page
 * was the loudest thing on it.
 */
function PlaceholderChips({
  items,
  field,
  onInsert,
}: {
  items: readonly { key: string }[];
  field: string;
  onInsert: (token: string) => void;
}) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-wrap gap-tight">
      {items.map((p) => {
        const name = p.key.slice(1, -1);
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onInsert(p.key)}
            aria-label={t("notifications.insertInto", { placeholder: p.key, field })}
            className="inline-flex min-h-11 items-center gap-tight rounded-sm bg-muted-wash px-comfortable text-[0.8125rem] transition-colors duration-quick hover:bg-line/40 md:min-h-9"
          >
            <Plus size={14} strokeWidth={1.5} aria-hidden className="text-muted" />
            <code className="font-mono text-[0.75rem] text-fg">{p.key}</code>
            <span className="text-muted">{t(`notifications.ph.${name}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A whole number of hours inside the range, or null. */
function hoursIn(raw: string, { min, max }: { min: number; max: number }): number | null {
  const n = Number(raw.trim());
  return raw.trim() !== "" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Notifications — everything the business sends, and when.
 *
 * This was one textarea: the ticket SMS. Booking systems settle on a fuller
 * shape and operators expect it — each moment in a booking's life (confirmed,
 * a reminder the day before, moved, cancelled, refunded, a thank-you after)
 * switched on per channel; when the scheduled ones go out, with a quiet window
 * so a reminder does not buzz a phone at midnight; who a message is from; and,
 * beside the customer's messages, the alerts the team gets, each sent to the
 * roles that should hear it.
 *
 * One save for the whole page. The ticket wording lives on the business
 * profile and the rest in its own settings record, but a person editing "what
 * customers are sent" is making one decision, and two save bars would ask them
 * which half they meant.
 */
export default function NotificationsPage() {
  const t = useTranslations("settings");
  const toast = useToast();
  const opQ = useApiQuery(() => getOperator(), []);
  const setQ = useApiQuery(() => getNotificationSettings(), []);
  const roleQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const field = useRef<HTMLTextAreaElement>(null);
  const subjectField = useRef<HTMLInputElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);

  const [base, setBase] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const saved =
    base ??
    (opQ.data && setQ.data
      ? (() => {
          const w = wording(opQ.data);
          return toForm(setQ.data, w.template, w.emailSubject, w.emailBody);
        })()
      : null);
  const form = draft ?? saved;
  const dirty = draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved);

  if (form === null || saved === null) {
    return (
      <PageShell title={t("notifications.title")} description={t("notifications.description")}>
        <SectionSkeleton />
      </PageShell>
    );
  }

  const roles = roleQ.data?.data ?? [];
  const reminder = hoursIn(form.reminderHours, REMINDER_RANGE);
  const followUp = hoursIn(form.followUpHours, FOLLOW_UP_RANGE);
  const errors = {
    reminder: reminder === null ? t("notifications.hoursRange", REMINDER_RANGE) : undefined,
    followUp: followUp === null ? t("notifications.hoursRange", FOLLOW_UP_RANGE) : undefined,
    quiet: form.quietHours.enabled && form.quietHours.from === form.quietHours.to ? t("notifications.quietSame") : undefined,
    sender: SENDER.test(form.senderName.trim()) ? undefined : t("notifications.senderInvalid"),
    replyTo: form.replyToEmail.trim() && !EMAIL.test(form.replyToEmail.trim()) ? t("notifications.replyInvalid") : undefined,
    template: form.template.trim() ? undefined : t("notifications.empty"),
    emailSubject: form.emailSubject.trim() ? undefined : t("notifications.empty"),
    emailBody: form.emailBody.trim() ? undefined : t("notifications.empty"),
  };
  // An alert switched on with nobody to send it to is an alert that is off
  // while claiming to be on.
  const unaddressed = (ev: StaffNotificationEvent) => form.staff[ev].enabled && form.staff[ev].roleIds.length === 0;
  const invalid = Object.values(errors).some(Boolean) || STAFF_EVENTS.some(unaddressed);

  const set = (patch: Partial<Form>) => setDraft({ ...form, ...patch });
  const setChannel = (ev: CustomerNotificationEvent, ch: NotificationChannel, on: boolean) =>
    set({ customer: { ...form.customer, [ev]: { ...form.customer[ev], [ch]: on } } });
  const setAlert = (ev: StaffNotificationEvent, patch: Partial<Form["staff"][StaffNotificationEvent]>) =>
    set({ staff: { ...form.staff, [ev]: { ...form.staff[ev], ...patch } } });
  const toggleRole = (ev: StaffNotificationEvent, roleId: string) => {
    const ids = form.staff[ev].roleIds;
    setAlert(ev, { roleIds: ids.includes(roleId) ? ids.filter((id) => id !== roleId) : [...ids, roleId] });
  };

  /* One helper for the SMS body, the e-mail subject and the e-mail body:
     three copies of this would be three places to put the caret back wrong. */
  type Wording = "template" | "emailSubject" | "emailBody";
  const insertInto = (
    ref: React.RefObject<HTMLTextAreaElement | null> | React.RefObject<HTMLInputElement | null>,
    key: Wording,
    token: string,
  ) => {
    const el = ref.current;
    const value = form[key];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set({ [key]: value.slice(0, start) + token + value.slice(end) } as Partial<Form>);
    // The caret goes after what was inserted — where the next keystroke belongs.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };
  const insert = (token: string) => insertInto(field, "template", token);

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    const wordingChanged =
      form.template !== saved.template ||
      form.emailSubject !== saved.emailSubject ||
      form.emailBody !== saved.emailBody;
    const [settingsRes, opRes] = await Promise.all([
      updateNotificationSettings(fromForm(form)),
      wordingChanged
        ? updateOperator({
            smsTemplate: form.template,
            emailSubject: form.emailSubject.trim(),
            emailTemplate: form.emailBody,
          })
        : Promise.resolve(null),
    ]);
    setSaving(false);
    if (!settingsRes.ok) {
      toast.error(settingsRes.error.message);
      return;
    }
    if (opRes && !opRes.ok) {
      toast.error(opRes.error.message);
      return;
    }
    const w = opRes?.ok ? wording(opRes.data) : { template: form.template, emailSubject: form.emailSubject, emailBody: form.emailBody };
    setBase(toForm(settingsRes.data, w.template, w.emailSubject, w.emailBody));
    setDraft(null);
    toast.success(t("notifications.saved"));
  };

  const preview = renderSms(form.template, {
    business: opQ.data?.name ?? "",
    code: SAMPLE_CODE,
    date: formatDay(DEMO_TODAY, { weekday: true }),
  });
  const cost = smsCost(preview);

  /* The e-mail, rendered with the same sample a cashier would send: one
     ticket, today, for a real-looking amount. */
  const mailVars = {
    business: opQ.data?.name ?? "",
    reference: SAMPLE_REFERENCE,
    code: SAMPLE_CODE,
    date: formatDay(DEMO_TODAY, { weekday: true }),
    count: "2",
    total: formatMoney(115000, opQ.data?.currency ?? "BDT"),
  };
  const subjectPreview = renderSms(form.emailSubject, mailVars);
  const bodyPreview = renderSms(form.emailBody, mailVars);
  const emailDefault = form.emailSubject === DEFAULT_EMAIL_SUBJECT && form.emailBody === DEFAULT_EMAIL_BODY;

  return (
    <PageShell title={t("notifications.title")} description={t("notifications.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("notifications.customerTitle")} description={t("notifications.customerDesc")} divided>
          {CUSTOMER_EVENTS.map((ev) => {
            const row = form.customer[ev];
            const title = t(`notifications.event.${ev}.title`);
            // Hours in the sentence follow the timing fields below as they are
            // typed, and hold the saved figure while a field reads as nonsense.
            const hours = ev === "followUp" ? followUp ?? Number(saved.followUpHours) : reminder ?? Number(saved.reminderHours);
            const silent = ev === "confirmation" && !row.sms && !row.email;
            return (
              /* The name and its two switches share the first line, the sentence
                 under them runs the full width: on a phone that is a two-line row
                 with the controls at the right edge, the way a phone's own
                 settings draw it. From sm the switches sit beside both lines. */
              <div key={ev} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-section gap-y-inline px-card py-section sm:gap-x-major">
                <p className="col-start-1 row-start-1 text-sm font-medium text-fg">{title}</p>
                <div className="col-start-2 row-start-1 flex items-center gap-section sm:row-span-2">
                  {CHANNELS.map((ch) => {
                    const channel = t(`notifications.channel.${ch}`);
                    return (
                      <span key={ch} className="flex items-center gap-tight">
                        <span aria-hidden className="text-[0.8125rem] text-muted">
                          {channel}
                        </span>
                        <Switch
                          checked={row[ch]}
                          onChange={(on) => setChannel(ev, ch, on)}
                          label={t("notifications.channelSwitch", { event: title, channel })}
                        />
                      </span>
                    );
                  })}
                </div>
                <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1">
                  <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`notifications.event.${ev}.desc`, { hours })}</p>
                  {silent && <p className="mt-inline text-[0.8125rem] leading-relaxed text-warning">{t("notifications.noTicket")}</p>}
                </div>
              </div>
            );
          })}
        </SettingsSection>

        <SettingsSection title={t("notifications.timingTitle")} description={t("notifications.timingDesc")}>
          <SettingRow
            label={t("notifications.reminderHours")}
            description={reminder === null ? t("notifications.reminderHoursDesc") : t("notifications.reminderHoursNow", { hours: reminder })}
            error={errors.reminder}
          >
            {({ id, describedBy }) => (
              <SuffixInput
                id={id}
                value={form.reminderHours}
                onChange={(v) => set({ reminderHours: v })}
                suffix={t("notifications.hours")}
                invalid={!!errors.reminder}
                describedBy={describedBy}
                inputMode="numeric"
              />
            )}
          </SettingRow>
          <SettingRow
            label={t("notifications.followUpHours")}
            description={followUp === null ? t("notifications.followUpHoursDesc") : t("notifications.followUpHoursNow", { hours: followUp })}
            error={errors.followUp}
          >
            {({ id, describedBy }) => (
              <SuffixInput
                id={id}
                value={form.followUpHours}
                onChange={(v) => set({ followUpHours: v })}
                suffix={t("notifications.hours")}
                invalid={!!errors.followUp}
                describedBy={describedBy}
                inputMode="numeric"
              />
            )}
          </SettingRow>
          <SettingRow
            label={t("notifications.quiet")}
            description={form.quietHours.enabled ? t("notifications.quietOn", { to: formatClock(form.quietHours.to) }) : t("notifications.quietOff")}
            labelFor={false}
            trailing
          >
            {({ labelId, describedBy }) => (
              <Switch
                checked={form.quietHours.enabled}
                onChange={(enabled) => set({ quietHours: { ...form.quietHours, enabled } })}
                labelledBy={labelId}
                describedBy={describedBy}
              />
            )}
          </SettingRow>
          {/* The window itself only matters while the switch is on, and a pair of
              time fields cannot share a phone's row with the words beside them,
              so it gets a line under them. */}
          {form.quietHours.enabled && (
            <div className="-mt-tight flex flex-wrap items-center gap-tight px-card pb-section">
              <TimeField
                value={form.quietHours.from}
                onChange={(from) => set({ quietHours: { ...form.quietHours, from } })}
                label={t("notifications.quietFrom")}
                invalid={!!errors.quiet}
              />
              <span aria-hidden className="text-[0.8125rem] text-muted">
                {t("notifications.to")}
              </span>
              <TimeField
                value={form.quietHours.to}
                onChange={(to) => set({ quietHours: { ...form.quietHours, to } })}
                label={t("notifications.quietTo")}
                invalid={!!errors.quiet}
              />
              {errors.quiet && (
                <p role="alert" className="w-full text-[0.75rem] text-danger">
                  {errors.quiet}
                </p>
              )}
            </div>
          )}
        </SettingsSection>

        <SettingsSection title={t("notifications.senderTitle")} description={t("notifications.senderDesc")}>
          <SettingRow label={t("notifications.senderName")} description={t("notifications.senderNameDesc")} error={errors.sender}>
            {({ id, describedBy }) => (
              <div className="relative">
                <input
                  id={id}
                  value={form.senderName}
                  maxLength={11}
                  placeholder={t("notifications.senderPlaceholder")}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => set({ senderName: e.target.value })}
                  aria-invalid={!!errors.sender || undefined}
                  aria-describedby={describedBy}
                  className={cn(controlCls(!!errors.sender), "pr-16")}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-comfortable flex items-center text-[13px] tabular-nums text-muted"
                >
                  {form.senderName.length}/11
                </span>
              </div>
            )}
          </SettingRow>
          <SettingRow label={t("notifications.replyTo")} description={t("notifications.replyToDesc")} error={errors.replyTo}>
            {({ id, describedBy }) => (
              <input
                id={id}
                type="email"
                autoComplete="email"
                placeholder={t("notifications.replyToPlaceholder")}
                value={form.replyToEmail}
                onChange={(e) => set({ replyToEmail: e.target.value })}
                aria-invalid={!!errors.replyTo || undefined}
                aria-describedby={describedBy}
                className={controlCls(!!errors.replyTo)}
              />
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          title={t("notifications.smsTitle")}
          description={t("notifications.smsDesc")}
          aside={
            form.template !== DEFAULT_SMS_TEMPLATE ? (
              <button
                type="button"
                onClick={() => set({ template: DEFAULT_SMS_TEMPLATE })}
                className="inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:min-h-9"
              >
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
                {t("notifications.reset")}
              </button>
            ) : undefined
          }
        >
          <SettingRow label={t("notifications.message")} description={t("notifications.messageDesc")} layout="stack" error={errors.template}>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-tight">
                <textarea
                  ref={field}
                  id={id}
                  rows={4}
                  value={form.template}
                  onChange={(e) => set({ template: e.target.value })}
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.template || undefined}
                  className={cn(
                    "w-full min-w-0 resize-y rounded-sm border bg-card px-comfortable py-tight text-sm leading-relaxed text-fg outline-none transition-colors duration-quick",
                    errors.template ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
                  )}
                />
                <PlaceholderChips items={SMS_PLACEHOLDERS} field={t("notifications.targetSms")} onInsert={insert} />
              </div>
            )}
          </SettingRow>

          <SettingRow label={t("notifications.preview")} description={t("notifications.previewDesc")} layout="stack" labelFor={false}>
            {() => (
              <div className="flex flex-col gap-tight">
                {/* The sender above the bubble, because that is the first thing
                    a phone shows and the reason the name field exists. */}
                <p className="text-[0.75rem] font-medium text-muted">{t("notifications.from", { sender: form.senderName.trim() || "—" })}</p>
                {/* Drawn as the message bubble a phone shows, because that
                    is the only place a customer ever reads it. */}
                <p className="max-w-sm whitespace-pre-wrap break-words rounded-sm rounded-bl-xs bg-muted-wash px-section py-comfortable text-sm leading-relaxed text-fg">
                  {preview}
                </p>
<p className="text-[0.75rem] text-muted">
                  {t("notifications.length", { count: cost.chars })} · {t("notifications.segments", { count: cost.segments })}
                </p>
                {cost.unicode && <p className="max-w-prose text-[0.75rem] text-muted">{t("notifications.unicode")}</p>}
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        {/* ── the e-mail ──────────────────────────────────────────────────
            The same ticket, in the other channel. It used to be the only
            message the operator could NOT write: the SMS was theirs and the
            e-mail was the product's own copy, so one sale arrived in two
            voices. Subject and body are edited apart because an inbox shows
            them apart — and the subject is the half that gets cut. */}
        <SettingsSection
          title={t("notifications.emailTitle")}
          description={t("notifications.emailDesc")}
          aside={
            !emailDefault ? (
              <button
                type="button"
                onClick={() => set({ emailSubject: DEFAULT_EMAIL_SUBJECT, emailBody: DEFAULT_EMAIL_BODY })}
                className="inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:min-h-9"
              >
                <RotateCcw size={14} strokeWidth={1.5} aria-hidden />
                {t("notifications.reset")}
              </button>
            ) : undefined
          }
        >
          <SettingRow
            label={t("notifications.emailSubject")}
            description={t("notifications.emailSubjectDesc", { visible: SUBJECT_VISIBLE })}
            layout="stack"
            error={errors.emailSubject}
          >
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-tight">
                <input
                  ref={subjectField}
                  id={id}
                  type="text"
                  value={form.emailSubject}
                  onChange={(e) => set({ emailSubject: e.target.value })}
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.emailSubject || undefined}
                  className={cn(
                    "h-11 w-full min-w-0 rounded-sm border bg-card px-comfortable text-sm text-fg outline-none transition-colors duration-quick md:h-9",
                    errors.emailSubject ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
                  )}
                />
                <PlaceholderChips items={EMAIL_PLACEHOLDERS} field={t("notifications.targetSubject")} onInsert={(token) => insertInto(subjectField, "emailSubject", token)} />
              </div>
            )}
          </SettingRow>

          <SettingRow label={t("notifications.emailBody")} description={t("notifications.emailBodyDesc")} layout="stack" error={errors.emailBody}>
            {({ id, describedBy }) => (
              <div className="flex flex-col gap-tight">
                <textarea
                  ref={bodyField}
                  id={id}
                  rows={8}
                  value={form.emailBody}
                  onChange={(e) => set({ emailBody: e.target.value })}
                  aria-describedby={describedBy}
                  aria-invalid={!!errors.emailBody || undefined}
                  className={cn(
                    "w-full min-w-0 resize-y rounded-sm border bg-card px-comfortable py-tight text-sm leading-relaxed text-fg outline-none transition-colors duration-quick",
                    errors.emailBody ? "border-danger focus:ring-2 focus:ring-danger/20" : "border-line focus:border-ember focus:ring-2 focus:ring-ember/20",
                  )}
                />
                <PlaceholderChips items={EMAIL_PLACEHOLDERS} field={t("notifications.targetBody")} onInsert={(token) => insertInto(bodyField, "emailBody", token)} />
              </div>
            )}
          </SettingRow>

          <SettingRow label={t("notifications.emailPreview")} description={t("notifications.emailPreviewDesc")} layout="stack" labelFor={false}>
            {() => (
              <div className="flex flex-col gap-tight">
                {/* Drawn the way an inbox draws it: who it is from, then the
                    subject, then the first line — which is the whole of what
                    somebody decides on before they open anything. */}
                <div className="max-w-prose rounded-sm bg-muted-wash px-section py-comfortable">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-tight gap-y-inline">
                    <span className="text-[0.8125rem] font-medium text-fg">{form.senderName.trim() || "—"}</span>
                    <span className="text-[0.75rem] text-muted">{form.replyToEmail.trim() || t("notifications.noReplyTo")}</span>
                  </div>
                  <p className="mt-comfortable break-words text-sm font-semibold text-fg">
                    {subjectPreview.slice(0, SUBJECT_VISIBLE)}
                    {subjectPreview.length > SUBJECT_VISIBLE && (
                      /* What a phone stops showing. Drawn rather than
                         described, because "about 45 characters" means
                         nothing until you see where your own subject ends. */
                      <span className="text-muted">{subjectPreview.slice(SUBJECT_VISIBLE)}</span>
                    )}
                  </p>
                  <p className="mt-tight whitespace-pre-wrap break-words text-sm leading-relaxed text-fg">{bodyPreview}</p>
                </div>
                <p className="text-[0.75rem] text-muted">
                  {t("notifications.subjectLength", { count: subjectPreview.length, visible: SUBJECT_VISIBLE })}
                </p>
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("notifications.staffTitle")} description={t("notifications.staffDesc")} divided>
          {STAFF_EVENTS.map((ev) => {
            const alert = form.staff[ev];
            const title = t(`notifications.alert.${ev}.title`);
            return (
              <div key={ev}>
                <SettingRow label={title} description={t(`notifications.alert.${ev}.desc`)} labelFor={false} trailing>
                  {({ labelId, describedBy }) => (
                    <Switch
                      checked={alert.enabled}
                      onChange={(enabled) => setAlert(ev, { enabled })}
                      labelledBy={labelId}
                      describedBy={describedBy}
                    />
                  )}
                </SettingRow>
                {/* Who hears it only matters while it is on, so the roles stay
                    out of the way until then. */}
                {alert.enabled && roles.length > 0 && (
                  <div
                    role="group"
                    aria-label={t("notifications.sendToLabel", { alert: title })}
                    className="-mt-tight flex flex-wrap items-center gap-tight px-card pb-section"
                  >
                    <span aria-hidden className="mr-inline text-[0.8125rem] text-muted">
                      {t("notifications.sendTo")}
                    </span>
                    {roles.map((r) => {
                      const on = alert.roleIds.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleRole(ev, r.id)}
                          className={cn(
                            "inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[0.8125rem] font-medium transition-colors duration-quick md:min-h-9",
                            on ? "bg-ember/5 text-fg ring-2 ring-inset ring-ember-solid" : "bg-muted-wash text-muted hover:bg-line/40 hover:text-fg",
                          )}
                        >
                          {on && <Check size={14} strokeWidth={2} aria-hidden className="text-brand-foreground" />}
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {unaddressed(ev) && <p className="px-card pb-section text-[0.75rem] text-danger">{t("notifications.pickRoles")}</p>}
              </div>
            );
          })}
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}
