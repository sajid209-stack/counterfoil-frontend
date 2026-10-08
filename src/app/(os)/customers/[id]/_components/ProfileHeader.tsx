"use client";

import { useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Mail, MessageSquare, Phone, Plus } from "lucide-react";
import { Button, StatusPill, useToast, type PillTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { updateCustomer, type Customer } from "@/lib/api";
import { formatDay } from "@/lib/format";
import type { CustomerProfile, Relationship } from "@/lib/customerProfile";

/** Initials from a name, at most two — "Mohammad Abdur Rahman Chowdhury"
 *  becomes MC, not MARC. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

const REL_TONE: Record<Relationship, PillTone> = { new: "info", regular: "success", lapsed: "warning" };

/** A contact action drawn as a button. A link, because that is what it is:
 *  tel:, sms: and mailto: hand the number to the phone's own apps. 44px on a
 *  phone, the density the rest of OS uses from `md`. Copying the number is on
 *  the Contact card, which is where somebody looks for it. */
const ACTION =
  "inline-flex h-11 items-center justify-center gap-tight rounded-sm border border-line bg-card px-comfortable text-[0.8125rem] font-medium text-fg transition-colors duration-quick hover:border-strong md:h-9";

/**
 * Who this is, before anything they have bought.
 *
 * One card: a large tinted mark, how they relate to the business said in
 * words (a chip for the one-word answer, a line for the figures behind it),
 * their tags with a way to add one, and the ways to reach them as real
 * buttons. The name is deliberately not here: the page heading already is the
 * name, and saying it twice forty pixels apart is not emphasis.
 */
export function ProfileHeader({
  customer,
  profile,
  onChanged,
}: {
  customer: Customer;
  profile: CustomerProfile;
  onChanged: () => void;
}) {
  const t = useTranslations("customers");
  const format = useFormatter();

  const since = format.dateTime(new Date(customer.createdAt), { month: "short", year: "numeric" });
  const days = profile.daysSinceLastBooked;
  const last =
    profile.lastBooked == null || days == null
      ? null
      : days === 0
        ? t("lastBookedToday")
        : days <= 45
          ? t("lastBookedDays", { days })
          : t("lastBookedOn", { date: formatDay(profile.lastBooked.slice(0, 10)) });
  const line = [
    t("sinceLine", { when: since }),
    profile.bookedCount > 0 ? t("bookedCount", { count: profile.bookedCount }) : t("noBookings"),
    last,
  ]
    .filter(Boolean)
    .join(" · ");

  const phone = customer.phone?.replace(/\s+/g, "") ?? null;
  const hasActions = !!(phone || customer.email);

  return (
    <section aria-label={t("profileLabel")} className="card-surface flex flex-col gap-section p-card lg:flex-row lg:items-center lg:justify-between lg:gap-major">
      <div className="flex min-w-0 flex-col gap-section">
      <div className="flex items-center gap-section">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-subtle text-xl font-semibold text-fg dark:bg-fg/10"
        >
          {initialsOf(customer.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-tight">
          {(profile.relationship || customer.status === "archived") && (
            <div className="flex flex-wrap items-center gap-tight">
              {profile.relationship && (
                <StatusPill tone={REL_TONE[profile.relationship]}>
                  {t(`rel_${profile.relationship}` as "rel_new")}
                </StatusPill>
              )}
              {customer.status === "archived" && <StatusPill tone="neutral">{t("archivedLabel")}</StatusPill>}
            </div>
          )}
          <p className="text-sm text-muted">{line}</p>
        </div>
      </div>

      <Tags customer={customer} onChanged={onChanged} />
      </div>

      {hasActions ? (
        <div className="grid grid-cols-3 gap-tight sm:flex sm:flex-wrap lg:shrink-0 lg:justify-end">
          {phone && (
            <a href={`tel:${phone}`} className={ACTION}>
              <Phone size={16} strokeWidth={1.6} aria-hidden />
              {t("actCall")}
            </a>
          )}
          {phone && (
            <a href={`sms:${phone}`} className={ACTION}>
              <MessageSquare size={16} strokeWidth={1.6} aria-hidden />
              {t("actSms")}
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} className={ACTION}>
              <Mail size={16} strokeWidth={1.6} aria-hidden />
              {t("actEmail")}
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("noContact")}</p>
      )}
    </section>
  );
}

const MAX_TAG = 24;

/** Their tags, and an inline way to add one. Removing a tag lives in Edit,
 *  where the whole list is one field: a 44px "x" on every chip would make the
 *  row as tall as a form. */
function Tags({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setValue("");
    setError(null);
    // Hand focus back to the control that opened the field.
    requestAnimationFrame(() => opener.current?.focus());
  };

  const add = async () => {
    const tag = value.trim().replace(/\s+/g, " ");
    if (!tag) return setError(t("tagEmpty"));
    if (tag.length > MAX_TAG) return setError(t("tagTooLong", { max: MAX_TAG }));
    if (customer.tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return setError(t("tagDuplicate"));
    setSaving(true);
    const res = await updateCustomer(customer.id, { tags: [...customer.tags, tag] });
    setSaving(false);
    if (!res.ok) return setError(res.error.message);
    toast.success(t("tagAdded"));
    setOpen(false);
    setValue("");
    setError(null);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-tight">
      <div className="flex flex-wrap items-center gap-tight">
        {customer.tags.map((tag) => (
          <StatusPill key={tag} tone="neutral">
            {tag}
          </StatusPill>
        ))}
        {!open && (
          <button
            ref={opener}
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 items-center gap-inline rounded-full px-comfortable text-[0.8125rem] font-medium text-muted transition-colors duration-quick hover:bg-muted-wash hover:text-fg md:h-9"
          >
            <Plus size={14} strokeWidth={1.8} aria-hidden />
            {t("addTag")}
          </button>
        )}
      </div>
      {open && (
        <form
          className="flex flex-col gap-tight sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <input
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  close();
                }
              }}
              aria-label={t("tagLabel")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "tag-error" : undefined}
              placeholder={t("tagPlaceholder")}
              maxLength={MAX_TAG + 8}
              className={cn(
                "h-11 w-full rounded-sm border bg-card px-comfortable text-sm outline-none transition-colors duration-quick placeholder:text-muted md:h-9",
                error ? "border-danger" : "border-line focus:border-inverse",
              )}
            />
            {error && (
              <p id="tag-error" role="alert" className="mt-inline text-[0.8125rem] text-danger">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-tight">
            <Button type="submit" size="sm" loading={saving}>
              {t("tagAdd")}
            </Button>
            <Button type="button" size="sm" variant="tertiary" onClick={close}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
