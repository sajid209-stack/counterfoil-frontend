"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Pencil } from "lucide-react";
import { Button, FormField, Modal, useToast } from "@/components/ui";
import { updateCustomer, type Customer } from "@/lib/api";
import { Panel } from "./Panel";
import { useCopy } from "./useCopy";

/**
 * Phone and e-mail, each one tap from the clipboard, and the way to change
 * them. Editing opens the details form in a dialog — the page itself is about
 * the person, and a form permanently open on it would make it a record to be
 * maintained rather than read.
 */
export function ContactCard({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useTranslations("customers");
  const toast = useToast();
  const { copied, copy } = useCopy();
  const [editing, setEditing] = useState(false);
  /* Stable: Modal re-subscribes its key handler (and re-records where to hand
     focus back to) whenever onClose changes identity, which would steal focus
     from the field being typed in on every keystroke. */
  const closeEdit = useCallback(() => setEditing(false), []);

  const doCopy = async (id: string, text: string) => {
    if (!(await copy(id, text))) toast.error(t("copyFailed"));
  };

  const rows = [
    { id: "phone", label: t("fieldPhone"), value: customer.phone, aria: t("copyPhoneAria") },
    { id: "email", label: t("fieldEmail"), value: customer.email, aria: t("copyEmailAria") },
  ];

  return (
    <>
      <Panel
        title={t("contactTitle")}
        aside={
          <Button variant="secondary" size="sm" icon={<Pencil size={14} strokeWidth={1.6} />} onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        }
      >
        <dl className="flex flex-col">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-comfortable border-b border-hairline py-comfortable first:pt-0 last:border-0 last:pb-0">
              <div className="min-w-0">
                <dt className="text-[0.75rem] text-muted">{r.label}</dt>
                <dd className={r.value ? "break-all text-sm text-fg" : "text-sm text-muted"}>{r.value ?? t("notAdded")}</dd>
              </div>
              {r.value && (
                <button
                  type="button"
                  aria-label={copied === r.id ? t("copied") : r.aria}
                  onClick={() => doCopy(r.id, r.value!)}
                  className="inline-flex h-11 shrink-0 items-center gap-inline rounded-sm px-comfortable text-[0.8125rem] font-medium text-fg hover:bg-muted-wash md:h-9"
                >
                  {copied === r.id ? (
                    <Check size={14} strokeWidth={1.8} aria-hidden className="text-success" />
                  ) : (
                    <Copy size={14} strokeWidth={1.6} aria-hidden />
                  )}
                  {copied === r.id ? t("copied") : t("copy")}
                </button>
              )}
            </div>
          ))}
        </dl>
      </Panel>
      {editing && (
        <EditDetails
          key={customer.updatedAt}
          customer={customer}
          onClose={closeEdit}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

/** The details form, in a dialog. Mounted only while open, so it always starts
 *  from the record as it is now rather than from whatever was typed last time. */
function EditDetails({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("customers");
  const toast = useToast();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [tags, setTags] = useState(customer.tags.join(", "));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t("nameRequired");
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("emailInvalid");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSaving(true);
    const res = await updateCustomer(customer.id, {
      name: name.trim(),
      phone,
      email,
      tags: tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSaving(false);
    if (!res.ok) {
      if (res.error.fieldErrors && Object.keys(res.error.fieldErrors).length > 0) setErrors(res.error.fieldErrors);
      else toast.error(res.error.message);
      return;
    }
    toast.success(t("detailsSaved"));
    onSaved();
  };

  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: "" }));

  return (
    <Modal
      open
      onClose={onClose}
      title={t("editTitle")}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={save} loading={saving}>
            {t("saveDetails")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <FormField
          label={t("fieldName")}
          value={name}
          error={errors.name || undefined}
          onChange={(e) => {
            setName(e.target.value);
            clear("name");
          }}
        />
        <FormField
          label={t("fieldPhone")}
          value={phone}
          error={errors.phone || undefined}
          onChange={(e) => {
            setPhone(e.target.value);
            clear("phone");
          }}
          help={t("phoneHelp")}
        />
        <FormField
          label={t("fieldEmail")}
          variant="email"
          value={email}
          error={errors.email || undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            clear("email");
          }}
        />
        <FormField label={t("fieldTags")} value={tags} onChange={(e) => setTags(e.target.value)} help={t("tagsHelp")} />
      </div>
    </Modal>
  );
}
