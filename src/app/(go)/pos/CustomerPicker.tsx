"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Search, UserPlus } from "lucide-react";
import { Button, FormField, Modal, useToast } from "@/components/ui";
import {
  listCustomerRows,
  matchOrCreateCustomer,
  type CustomerWithStats,
} from "@/lib/api";
import { formatMoney } from "@/lib/format";

export interface AttachedCustomer {
  id: string | null;
  name: string;
  /** Carried onto the till so the flag reason can be shown while serving. */
  flagReason?: string | null;
  /** Shown under the name in the cart. Two customers share a name far more
   *  often than they share a phone, so this is what tells a cashier they
   *  attached the right person. */
  phone?: string | null;
  email?: string | null;
}

/**
 * Attach a sale to a customer at the till.
 *
 * The old chip captured a name into a text box, which is how one person became
 * six records. This searches what already exists first, matches a walk-up on
 * their phone number, and only creates a record when nothing matches.
 */
export function CustomerPicker({
  open,
  onClose,
  attached,
  onAttach,
}: {
  open: boolean;
  onClose: () => void;
  attached: AttachedCustomer | null;
  onAttach: (customer: AttachedCustomer | null) => void;
}) {
  const t = useTranslations("pos");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("customerModal.title")}
      description={t("customerModal.description")}
      footer={
        <>
          {attached && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                onAttach(null);
                onClose();
              }}
            >
              {t("customerModal.remove")}
            </Button>
          )}
          <Button variant="secondary" size="lg" onClick={onClose}>
            {t("customerModal.close")}
          </Button>
        </>
      }
    >
      {/* Mounted only while open, so every visit starts clean — the last
          sale's search is never useful to the next one. */}
      {open && <PickerBody onAttach={onAttach} onClose={onClose} />}
    </Modal>
  );
}

function PickerBody({
  onAttach,
  onClose,
}: {
  onAttach: (customer: AttachedCustomer | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerWithStats[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced search. The latest keystroke wins: an earlier, slower response
  // must not overwrite a newer one.
  const seq = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      const mine = ++seq.current;
      queueMicrotask(() => {
        if (mine !== seq.current) return;
        setResults([]);
        setSearching(false);
      });
      return;
    }
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      if (mine !== seq.current) return;
      setSearching(true);
      const res = await listCustomerRows({ pageSize: 8, search: q });
      if (mine !== seq.current) return;
      setResults(res.ok ? res.data.data : []);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const attach = (c: CustomerWithStats) => {
    onAttach({ id: c.id, name: c.name, flagReason: c.flag?.reason ?? null, phone: c.phone, email: c.email });
    onClose();
  };

  const createAndAttach = async () => {
    setSaving(true);
    const res = await matchOrCreateCustomer({ name: newName, phone: newPhone });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.name ?? res.error.message);
      return;
    }
    onAttach({ id: res.data.id, name: res.data.name, flagReason: res.data.flag?.reason ?? null, phone: res.data.phone, email: res.data.email });
    toast.success(t("customerModal.attached", { name: res.data.name }));
    onClose();
  };

  if (creating) {
    return (
      <div className="flex flex-col gap-section">
        <FormField
          label={t("customerModal.nameLabel")}
          placeholder={t("customerModal.namePlaceholder")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <FormField
          label={t("customerModal.phoneLabel")}
          placeholder={t("customerModal.phonePlaceholder")}
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          help={t("customerModal.phoneHelp")}
        />
        <div className="flex flex-wrap gap-tight">
          <Button size="lg" loading={saving} disabled={!newName.trim()} onClick={createAndAttach}>
            {t("customerModal.attach")}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setCreating(false)}>
            {t("customerModal.backToSearch")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section">
      <div className="relative">
        <Search
          size={18}
          strokeWidth={1.5}
          className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Staff have a queue in front of them: one tap opens the sheet and
          // the keyboard is already where they need it.
          autoFocus
          placeholder={t("customerModal.searchPlaceholder")}
          className="h-12 w-full rounded-sm border border-line bg-card pl-9 pr-comfortable text-sm outline-none focus:border-ember"
        />
      </div>

      {searching && <div className="h-12 animate-pulse rounded-sm bg-subtle" />}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-[13px] text-muted">{t("customerModal.noMatches")}</p>
      )}

      <ul className="flex flex-col gap-tight">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => attach(c)}
              className="flex min-h-12 w-full items-center justify-between gap-tight rounded-sm border border-line p-comfortable text-left transition-colors duration-quick hover:bg-subtle active:bg-ember/10"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-inline">
                  <span className="min-w-0 break-words text-sm font-medium">{c.name}</span>
                  {c.flag && (
                    <AlertTriangle size={14} strokeWidth={1.5} className="shrink-0 text-warning" />
                  )}
                </span>
                {c.phone && (
                  <span className="block font-mono text-[13px] text-muted">{c.phone}</span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[13px] text-muted">
                {t("customerModal.spend", {
                  orders: c.stats.orders,
                  spent: formatMoney(c.stats.spent),
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        size="lg"
        icon={<UserPlus size={18} strokeWidth={1.5} />}
        onClick={() => {
          setNewName(query.trim());
          setCreating(true);
        }}
      >
        {t("customerModal.newCustomer")}
      </Button>
    </div>
  );
}
