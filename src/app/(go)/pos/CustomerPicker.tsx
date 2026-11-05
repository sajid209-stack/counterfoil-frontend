"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, UserPlus } from "lucide-react";
import { Button, FormField, Modal, Skeleton, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { primaryButton } from "../_components/ActionBar";
import { T } from "../_components/type";
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
/** Where the desktop's dropdown hangs: the Customer row's box, in viewport
 *  pixels, taken when the row is pressed. */
export interface PickerAnchor {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function CustomerPicker({
  open,
  onClose,
  attached,
  onAttach,
  anchor = null,
}: {
  open: boolean;
  onClose: () => void;
  attached: AttachedCustomer | null;
  onAttach: (customer: AttachedCustomer | null) => void;
  /** Given on a desktop: the picker is a dropdown under the Customer row, not a modal. */
  anchor?: PickerAnchor | null;
}) {
  const t = useTranslations("pos");

  if (anchor) {
    return open ? <PickerPopover anchor={anchor} onAttach={onAttach} onClose={onClose} /> : null;
  }

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

/** The desktop's dropdown: hangs under the Customer row, closes on an outside
 *  press or Escape. The new-customer form opens inside it, in place. */
function PickerPopover({
  anchor,
  onAttach,
  onClose,
}: {
  anchor: PickerAnchor;
  onAttach: (customer: AttachedCustomer | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("pos");
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = e.target as Element | null;
      /* The Customer row toggles the dropdown itself. */
      if (!el || box.current?.contains(el) || el.closest("[data-customer-anchor]")) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, []);
  return (
    <div
      ref={box}
      role="dialog"
      aria-label={t("customerModal.title")}
      style={{ left: anchor.left, top: anchor.top, width: anchor.width, maxHeight: anchor.maxHeight }}
      className="fixed z-50 flex flex-col overflow-hidden rounded-card bg-card shadow-md ring-1 ring-line"
    >
      <PickerBody onAttach={onAttach} onClose={onClose} inline />
    </div>
  );
}

function PickerBody({
  onAttach,
  onClose,
  inline = false,
}: {
  onAttach: (customer: AttachedCustomer | null) => void;
  onClose: () => void;
  inline?: boolean;
}) {
  const t = useTranslations("pos");
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerWithStats[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
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
    onAttach({ id: c.id, name: c.name, phone: c.phone, email: c.email });
    onClose();
  };

  const createAndAttach = async () => {
    setSaving(true);
    const res = await matchOrCreateCustomer({ name: newName, phone: newPhone, email: newEmail.trim() || null });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error.fieldErrors?.name ?? res.error.message);
      return;
    }
    onAttach({ id: res.data.id, name: res.data.name, phone: res.data.phone, email: res.data.email });
    toast.success(t("customerModal.attached", { name: res.data.name }));
    onClose();
  };

  if (inline) {
    const field = "h-10 w-full rounded-inner border border-line bg-card px-comfortable text-base text-fg placeholder:text-muted";
    if (creating) {
      return (
        <div className="flex min-h-0 flex-col gap-comfortable overflow-y-auto p-comfortable">
          <label className="flex flex-col gap-inline">
            <span className={T.label}>{t("customerModal.nameLabel")}</span>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("customerModal.namePlaceholder")} className={field} />
          </label>
          <label className="flex flex-col gap-inline">
            <span className={T.label}>{t("customerModal.phoneLabel")}</span>
            <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder={t("customerModal.phonePlaceholder")} inputMode="tel" className={field} />
            <span className={T.meta}>{t("customerModal.phoneHelp")}</span>
          </label>
          <label className="flex flex-col gap-inline">
            <span className={T.label}>{t("customerModal.emailLabel")}</span>
            <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t("customerModal.emailPlaceholder")} inputMode="email" className={field} />
          </label>
          <div className="flex items-center gap-comfortable">
            <button type="button" className={primaryButton("h-10", "flex-1")} disabled={!newName.trim() || saving} onClick={createAndAttach}>
              <span className={T.button}>{t("cart.attachCustomer")}</span>
            </button>
            <button type="button" onClick={() => setCreating(false)} className={cn("h-10 shrink-0 rounded-inner px-comfortable text-muted hover:bg-nav-hover", T.button)}>
              {t("custom.cancel")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="relative shrink-0 p-tight">
          <Search size={16} strokeWidth={1.5} aria-hidden className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            aria-label={t("customerModal.searchPlaceholder")}
            placeholder={t("customerModal.searchPlaceholder")}
            className={cn(field, "pl-9")}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {searching && <Skeleton h={44} className="mx-tight mb-tight rounded-inner" />}
          {!searching && query.trim().length >= 2 && results.length === 0 && <p className={cn(T.meta, "px-comfortable pb-tight")}>{t("customerModal.noMatches")}</p>}
          <ul className="divide-y divide-line">
            {results.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => attach(c)} className="flex min-h-11 w-full items-center justify-between gap-tight px-comfortable py-tight text-left hover:bg-nav-hover active:bg-nav-selected">
                  <span className="min-w-0">
                    <span className={cn(T.item, "block truncate")}>{c.name}</span>
                    {c.phone && <span className={cn(T.meta, "block tabular-nums")}>{c.phone}</span>}
                  </span>
                  <span className={cn(T.meta, "shrink-0 whitespace-nowrap tabular-nums")}>{t("customerModal.spend", { orders: c.stats.orders, spent: formatMoney(c.stats.spent) })}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => { setNewName(query.trim()); setCreating(true); }}
          className="flex h-11 w-full shrink-0 items-center gap-tight border-t border-line px-comfortable text-left hover:bg-nav-hover"
        >
          <UserPlus size={18} strokeWidth={1.6} aria-hidden className="shrink-0 text-muted" />
          <span className={cn(T.body, "font-medium")}>{t("customerModal.newCustomer")}</span>
        </button>
      </>
    );
  }

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
          className="absolute left-comfortable top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          // Staff have a queue in front of them: one tap opens the sheet and
          // the keyboard is already where they need it.
          autoFocus
          placeholder={t("customerModal.searchPlaceholder")}
          className="h-12 w-full rounded-full border border-line bg-card pl-9 pr-comfortable text-base"
        />
      </div>

      {searching && <Skeleton h={48} className="rounded-card" />}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-muted">{t("customerModal.noMatches")}</p>
      )}

      <ul className="flex flex-col gap-tight">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => attach(c)}
              className="flex min-h-12 w-full items-center justify-between gap-tight rounded-card border border-line p-comfortable text-left transition-colors duration-quick hover:bg-muted-wash active:bg-muted-wash"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-inline">
                  <span className="min-w-0 break-words text-base font-medium">{c.name}</span>
                </span>
                {c.phone && (
                  <span className="block text-sm tabular-nums text-muted">{c.phone}</span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap text-sm tabular-nums text-muted">
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
