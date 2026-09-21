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
import { DEMO_TODAY } from "@/lib/schedule";
import { formatDay } from "@/lib/format";
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
}

const toForm = (s: NotificationSettings, template: string): Form => ({
  ...s,
  reminderHours: String(s.reminderHours),
  followUpHours: String(s.followUpHours),
  replyToEmail: s.replyToEmail ?? "",
  template,
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

  const [base, setBase] = useState<Form | null>(null);
  const [draft, setDraft] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const saved = base ?? (opQ.data && setQ.data ? toForm(setQ.data, opQ.data.smsTemplate ?? DEFAULT_SMS_TEMPLATE) : null);
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

  const insert = (token: string) => {
    const el = field.current;
    const start = el?.selectionStart ?? form.template.length;
    const end = el?.selectionEnd ?? form.template.length;
    set({ template: form.template.slice(0, start) + token + form.template.slice(end) });
    // The caret goes after what was inserted — where the next keystroke belongs.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    const [settingsRes, opRes] = await Promise.all([
      updateNotificationSettings(fromForm(form)),
      form.template !== saved.template ? updateOperator({ smsTemplate: form.template }) : Promise.resolve(null),
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
    setBase(toForm(settingsRes.data, opRes?.ok ? opRes.data.smsTemplate ?? DEFAULT_SMS_TEMPLATE : form.template));
    setDraft(null);
    toast.success(t("notifications.saved"));
  };

  const preview = renderSms(form.template, {
    business: opQ.data?.name ?? "",
    code: SAMPLE_CODE,
    date: formatDay(DEMO_TODAY, { weekday: true }),
  });
  const cost = smsCost(preview);

  return (
    <PageShell title={t("notifications.title")} description={t("notifications.description")}>
      <div className="flex max-w-3xl flex-col gap-section pb-hero">
        <SettingsSection title={t("notifications.customerTitle")} description={t("notifications.customerDesc")}>
          {CUSTOMER_EVENTS.map((ev) => {
            const row = form.customer[ev];
            const title = t(`notifications.event.${ev}.title`);
            // Hours in the sentence follow the timing fields below as they are
            // typed, and hold the saved figure while a field reads as nonsense.
            const hours = ev === "followUp" ? followUp ?? Number(saved.followUpHours) : reminder ?? Number(saved.reminderHours);
            const silent = ev === "confirmation" && !row.sms && !row.email;
            return (
              <div key={ev} className="flex flex-col gap-tight px-card py-section sm:flex-row sm:items-center sm:gap-major">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{title}</p>
                  <p className="mt-inline text-[13px] leading-relaxed text-muted">{t(`notifications.event.${ev}.desc`, { hours })}</p>
                  {silent && <p className="mt-inline text-[13px] leading-relaxed text-warning">{t("notifications.noTicket")}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-section">
                  {CHANNELS.map((ch) => {
                    const channel = t(`notifications.channel.${ch}`);
                    return (
                      <span key={ch} className="flex items-center gap-tight">
                        <span aria-hidden className="text-[13px] text-muted">
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
              </div>
            );
          })}
        </SettingsSection>

        <SettingsSection title={t("notifications.timingTitle")} description={t("notifications.timingDesc")}>
          <SettingRow label={t("notifications.reminderHours")} description={t("notifications.reminderHoursDesc")} error={errors.reminder}>
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
          <SettingRow label={t("notifications.followUpHours")} description={t("notifications.followUpHoursDesc")} error={errors.followUp}>
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
            description={form.quietHours.enabled ? t("notifications.quietOn", { to: form.quietHours.to }) : t("notifications.quietOff")}
            labelFor={false}
            error={errors.quiet}
          >
            {({ labelId, describedBy }) => (
              <div className="flex flex-wrap items-center gap-tight sm:justify-end">
                {form.quietHours.enabled && (
                  <>
                    <TimeField
                      value={form.quietHours.from}
                      onChange={(from) => set({ quietHours: { ...form.quietHours, from } })}
                      label={t("notifications.quietFrom")}
                      invalid={!!errors.quiet}
                    />
                    <span aria-hidden className="text-[13px] text-muted">
                      {t("notifications.to")}
                    </span>
                    <TimeField
                      value={form.quietHours.to}
                      onChange={(to) => set({ quietHours: { ...form.quietHours, to } })}
                      label={t("notifications.quietTo")}
                      invalid={!!errors.quiet}
                    />
                  </>
                )}
                <Switch
                  checked={form.quietHours.enabled}
                  onChange={(enabled) => set({ quietHours: { ...form.quietHours, enabled } })}
                  labelledBy={labelId}
                  describedBy={describedBy}
                />
              </div>
            )}
          </SettingRow>
        </SettingsSection>

        <SettingsSection title={t("notifications.senderTitle")} description={t("notifications.senderDesc")}>
          <SettingRow label={t("notifications.senderName")} description={t("notifications.senderNameDesc")} error={errors.sender}>
            {({ id, describedBy }) => (
              <div className="relative">
                <input
                  id={id}
                  value={form.senderName}
                  maxLength={11}
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
                className="inline-flex min-h-11 items-center gap-inline rounded-sm px-comfortable text-[13px] font-medium text-muted transition-colors duration-quick hover:bg-subtle/60 hover:text-fg md:min-h-9"
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
                {/* The sender above the bubble, because that is the first thing
                    a phone shows and the reason the name field exists. */}
                <p className="text-[12px] font-medium text-muted">{t("notifications.from", { sender: form.senderName.trim() || "—" })}</p>
                {/* Drawn as the message bubble a phone shows, because that
                    is the only place a customer ever reads it. */}
                <p className="max-w-sm whitespace-pre-wrap break-words rounded-lg rounded-bl-xs bg-subtle px-section py-comfortable text-sm leading-relaxed text-fg ring-1 ring-inset ring-hairline">
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

        <SettingsSection title={t("notifications.staffTitle")} description={t("notifications.staffDesc")}>
          {STAFF_EVENTS.map((ev) => {
            const alert = form.staff[ev];
            const title = t(`notifications.alert.${ev}.title`);
            const titleId = `alert-${ev}-title`;
            const descId = `alert-${ev}-desc`;
            return (
              <div key={ev} className="px-card py-section">
                <div className="flex items-center justify-between gap-major">
                  <div className="min-w-0">
                    <p id={titleId} className="text-sm font-medium text-fg">
                      {title}
                    </p>
                    <p id={descId} className="mt-inline text-[13px] leading-relaxed text-muted">
                      {t(`notifications.alert.${ev}.desc`)}
                    </p>
                  </div>
                  <Switch
                    checked={alert.enabled}
                    onChange={(enabled) => setAlert(ev, { enabled })}
                    labelledBy={titleId}
                    describedBy={descId}
                  />
                </div>
                {/* Who hears it only matters while it is on, so the roles stay
                    out of the way until then. */}
                {alert.enabled && roles.length > 0 && (
                  <div
                    role="group"
                    aria-label={t("notifications.sendToLabel", { alert: title })}
                    className="mt-comfortable flex flex-wrap items-center gap-tight"
                  >
                    <span aria-hidden className="mr-inline text-[13px] text-muted">
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
                            "inline-flex min-h-11 items-center gap-inline rounded-sm border px-comfortable text-[13px] font-medium transition-colors duration-quick md:min-h-9",
                            on ? "border-ember-solid bg-ember/5 text-fg" : "border-line text-muted hover:bg-subtle/60 hover:text-fg",
                          )}
                        >
                          {on && <Check size={14} strokeWidth={2} aria-hidden className="text-brand-foreground" />}
                          {r.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {unaddressed(ev) && <p className="mt-tight text-[12px] text-danger">{t("notifications.pickRoles")}</p>}
              </div>
            );
          })}
        </SettingsSection>

        <SaveBar dirty={dirty} saving={saving} invalid={invalid} onSave={save} onDiscard={() => setDraft(null)} />
      </div>
    </PageShell>
  );
}
