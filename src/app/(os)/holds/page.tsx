"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Plus, Search, Undo2 } from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  FormField,
  Modal,
  PageShell,
  StatusPill,
  Tabs,
  useToast,
  type Column,
  type PillTone,
} from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import {
  CHECKOUT_HOLD_MINUTES,
  listHolds,
  listProducts,
  listResources,
  placeHold,
  releaseHold,
  type HoldKind,
  type HoldStatus,
  type HoldView,
} from "@/lib/api";
import { formatDate } from "@/lib/format";

const ACTOR = "Nadia Islam";

const TONE: Record<HoldStatus, PillTone> = {
  held: "warning",
  released: "neutral",
  converted: "success",
  expired: "neutral",
};

type Tab = "held" | "expired" | "released" | "converted";

export default function HoldsPage() {
  const t = useTranslations("holds");
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("held");
  const [search, setSearch] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const listQ = useApiQuery(
    () =>
      listHolds({
        pageSize: 500,
        search,
        filters: { effectiveStatus: tab, includeCheckout: showCheckout },
      }),
    [tab, search, showCheckout],
  );
  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data]);

  // Counts come from one unfiltered read rather than five, so the tabs cannot
  // disagree with the table.
  const allQ = useApiQuery(
    () => listHolds({ pageSize: 500, filters: { includeCheckout: showCheckout } }),
    [showCheckout, listQ.data],
  );
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { held: 0, expired: 0, released: 0, converted: 0 };
    for (const h of allQ.data?.data ?? []) c[h.effectiveStatus as Tab] += 1;
    return c;
  }, [allQ.data]);

  const release = async (h: HoldView) => {
    setBusy(h.id);
    const res = await releaseHold(h.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success(t("released", { heldFor: h.heldFor }));
    listQ.reload();
  };

  const columns: Column<HoldView>[] = [
    {
      key: "heldFor",
      header: t("colHeldFor"),
      render: (h) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-inline">
            <span className="break-words font-medium">{h.heldFor}</span>
            {h.kind === "session" && (
              <StatusPill tone="danger">
                <Lock size={11} strokeWidth={2} className="mr-0.5 inline" />
                {t("kind_session")}
              </StatusPill>
            )}
          </div>
          {h.reason && <div className="break-words text-[12px] text-muted">{h.reason}</div>}
        </div>
      ),
    },
    {
      key: "what",
      header: t("colWhat"),
      render: (h) => (
        <div className="min-w-0 text-[13px]">
          <div className="break-words">{h.productName || t("unknownProduct")}</div>
          <div className="text-[12px] text-muted">
            {h.kind === "resource"
              ? h.resourceName
              : h.kind === "seats"
                ? t("seatCount", { count: h.seatLabels?.length ?? 0 })
                : h.kind === "session"
                  ? t("wholeSession")
                  : t("placeCount", { count: h.quantity })}
          </div>
        </div>
      ),
    },
    {
      key: "when",
      header: t("colWhen"),
      render: (h) => (
        <div className="whitespace-nowrap font-mono text-[12px]">
          {formatDate(h.date)}
          {h.slotStart && <span className="ml-inline">{h.slotStart.slice(11, 16)}</span>}
          {!h.slotStart && <span className="ml-inline text-muted">{t("allDay")}</span>}
        </div>
      ),
    },
    {
      key: "expiry",
      header: t("colExpiry"),
      render: (h) =>
        h.expiresAt == null ? (
          <span className="text-[12px] text-muted">{t("untilReleased")}</span>
        ) : (
          <span
            className={`whitespace-nowrap font-mono text-[12px] ${
              (h.minutesToExpiry ?? 0) <= 0 ? "text-muted" : "text-warning"
            }`}
          >
            {(h.minutesToExpiry ?? 0) <= 0
              ? t("expiredAgo")
              : t("expiresIn", { minutes: h.minutesToExpiry ?? 0 })}
          </span>
        ),
    },
    {
      key: "placedBy",
      header: t("colPlacedBy"),
      render: (h) => <span className="text-[12px] text-muted">{h.placedBy}</span>,
    },
    {
      key: "status",
      header: t("colStatus"),
      render: (h) => (
        <StatusPill tone={TONE[h.effectiveStatus]}>{t(`status_${h.effectiveStatus}`)}</StatusPill>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (h) =>
        h.active ? (
          <Button
            size="sm"
            variant="secondary"
            icon={<Undo2 size={14} strokeWidth={1.5} />}
            loading={busy === h.id}
            onClick={() => release(h)}
          >
            {t("release")}
          </Button>
        ) : null,
    },
  ];

  const tabs = [
    { value: "held", label: t("tabHeld"), count: counts.held },
    { value: "expired", label: t("tabExpired"), count: counts.expired },
    { value: "released", label: t("tabReleased"), count: counts.released },
    { value: "converted", label: t("tabConverted"), count: counts.converted },
  ];

  return (
    <PageShell
      title={t("title")}
      description={t("description")}
      actions={
        <Button icon={<Plus size={16} strokeWidth={1.5} />} onClick={() => setPlacing(true)}>
          {t("newHold")}
        </Button>
      }
    >
      <div className="flex flex-col gap-section">
        <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(h) => h.id}
          loading={listQ.loading}
          toolbar={
            <div className="flex flex-wrap items-center gap-tight">
              <div className="relative">
                <Search
                  size={16}
                  strokeWidth={1.5}
                  className="absolute left-comfortable top-1/2 -translate-y-1/2 text-faint"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-11 md:h-9 w-72 max-w-full rounded-sm border border-line bg-card pl-8 pr-comfortable text-sm outline-none focus:border-inverse"
                />
              </div>
              <label className="flex items-center gap-tight text-[13px] text-muted">
                <input
                  type="checkbox"
                  checked={showCheckout}
                  onChange={(e) => setShowCheckout(e.target.checked)}
                  className="h-4 w-4 accent-ember"
                />
                {t("showCheckoutHolds", { minutes: CHECKOUT_HOLD_MINUTES })}
              </label>
            </div>
          }
          emptyState={<EmptyState title={t(`empty_${tab}`)} message={t("emptyMessage")} />}
        />
      </div>

      <PlaceHoldModal
        open={placing}
        onClose={() => setPlacing(false)}
        onPlaced={() => {
          setPlacing(false);
          listQ.reload();
        }}
      />
    </PageShell>
  );
}

const KINDS: HoldKind[] = ["capacity", "session", "resource", "seats"];

function PlaceHoldModal({
  open,
  onClose,
  onPlaced,
}: {
  open: boolean;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const t = useTranslations("holds");
  const toast = useToast();
  const productsQ = useApiQuery(() => listProducts({ pageSize: 100 }), [open]);
  const resourcesQ = useApiQuery(() => listResources({ pageSize: 100 }), [open]);

  const [kind, setKind] = useState<HoldKind>("capacity");
  const [productId, setProductId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [quantity, setQuantity] = useState("10");
  const [seats, setSeats] = useState("");
  const [heldFor, setHeldFor] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const products = productsQ.data?.data ?? [];
  const resources = resourcesQ.data?.data ?? [];
  const product = products.find((p) => p.id === productId);

  const submit = async () => {
    setSaving(true);
    const slotStart = time ? `${date}T${time}:00+06:00` : null;
    const res = await placeHold({
      productId,
      productName: product?.name ?? "",
      locationId: product?.locationIds?.[0] ?? null,
      kind,
      date,
      slotStart,
      quantity: kind === "capacity" ? Number(quantity || 0) : 0,
      seatLabels:
        kind === "seats"
          ? seats.split(",").map((x) => x.trim()).filter(Boolean)
          : undefined,
      resourceId: kind === "resource" ? resourceId : null,
      resourceName: kind === "resource" ? resources.find((r) => r.id === resourceId)?.name : null,
      heldFor,
      reason: reason.trim() || undefined,
      placedBy: ACTOR,
      expiresAt: expiryDays
        ? new Date(Date.now() + Number(expiryDays) * 86400000).toISOString()
        : null,
    });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.error.fieldErrors ?? {});
      toast.error(res.error.message);
      return;
    }
    setErrors({});
    setHeldFor("");
    setReason("");
    toast.success(t("placed", { heldFor: res.data.heldFor }));
    onPlaced();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t("newHoldTitle")}
      description={t("newHoldDescription")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!productId}>
            {t("placeHold")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-section">
        <div>
          <p className="type-label mb-tight text-[12px] text-muted">{t("fieldKind")}</p>
          <div className="flex flex-wrap gap-inline">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`min-h-11 md:h-9 rounded-sm border px-comfortable text-[13px] transition-colors duration-quick ${
                  kind === k
                    ? "border-ember bg-ember/10 text-brand-foreground"
                    : "border-line text-muted hover:bg-subtle"
                }`}
              >
                {t(`kind_${k}`)}
              </button>
            ))}
          </div>
          <p className="mt-tight text-[12px] text-muted">{t(`kindHelp_${kind}`)}</p>
        </div>

        <FormField
          label={t("fieldProduct")}
          variant="select"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          options={[
            { value: "", label: t("choose") },
            ...products.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />

        {kind === "resource" && (
          <FormField
            label={t("fieldResource")}
            variant="select"
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            error={errors.resourceId}
            options={[
              { value: "", label: t("choose") },
              ...resources.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
        )}

        <div className="grid grid-cols-1 gap-section sm:grid-cols-2">
          <FormField
            label={t("fieldDate")}
            variant="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={errors.date}
          />
          <FormField
            label={t("fieldTime")}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="14:00"
            help={t("timeHelp")}
          />
        </div>

        {kind === "capacity" && (
          <FormField
            label={t("fieldQuantity")}
            variant="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
            help={t("quantityHelp")}
          />
        )}

        {kind === "seats" && (
          <FormField
            label={t("fieldSeats")}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
            error={errors.seatLabels}
            help={t("seatsHelp")}
            placeholder="A1, A2, A3"
          />
        )}

        <FormField
          label={t("fieldHeldFor")}
          value={heldFor}
          onChange={(e) => setHeldFor(e.target.value)}
          error={errors.heldFor}
          help={t("heldForHelp")}
        />
        <FormField
          label={t("fieldReason")}
          variant="textarea"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          help={t("reasonHelp")}
        />
        <FormField
          label={t("fieldExpiry")}
          variant="number"
          value={expiryDays}
          onChange={(e) => setExpiryDays(e.target.value)}
          help={t("expiryHelp")}
        />

        <div className="rounded-sm border-l-2 border-ember bg-ember/5 p-comfortable">
          <p className="type-label text-[12px] text-muted">{t("previewLabel")}</p>
          <p className="mt-inline text-[13px]">
            {t(`preview_${kind}`, {
              what:
                kind === "resource"
                  ? (resources.find((r) => r.id === resourceId)?.name ?? t("somethingChosen"))
                  : kind === "seats"
                    ? String(seats.split(",").filter((x) => x.trim()).length)
                    : quantity,
              product: product?.name ?? t("aProduct"),
              when: `${formatDate(date)}${time ? ` ${time}` : ` (${t("allDay")})`}`,
              heldFor: heldFor || t("someone"),
            })}
          </p>
          <p className="mt-inline text-[13px] text-muted">
            {expiryDays
              ? t("previewExpiry", { days: expiryDays })
              : t("previewNoExpiry")}
          </p>
        </div>
      </div>
    </Modal>
  );
}
