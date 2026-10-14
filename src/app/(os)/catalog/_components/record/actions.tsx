"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Archive, Copy, Eye, EyeOff, Link2, RotateCcw, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { ConfirmDialog, useToast, type ActionMenuItem } from "@/components/ui";
import {
  archiveProduct,
  createProduct,
  deleteEvent,
  duplicateEvent,
  eventSold,
  updateProduct,
  type Product,
} from "@/lib/api";
import { slugOf } from "@/lib/api/products";
import { productCopy, type CatalogItem } from "@/lib/catalog";
import { formatDay } from "@/lib/format";
import { copyText, itemUrl, useOrigin } from "./parts";

/**
 * The record's one primary action and its "…" menu, for a booking and an event
 * alike: Put on sale / Take off sale as the primary, and Copy link · View page ·
 * Duplicate · Archive behind the menu. An archived item swaps them for Bring
 * back (and, for an event nobody bought tickets for, Delete).
 *
 * On and off sale act at once and offer Undo — the same rule the list follows.
 * Archiving asks first, and an event with tickets sold says how many.
 */
export function useRecordActions({
  product,
  item,
  onChanged,
}: {
  product: Product;
  item: CatalogItem;
  /** Told the saved item after anything that changes it, so the header follows. */
  onChanged: (next: Product) => void;
}) {
  const t = useTranslations("catalog");
  const te = useTranslations("events");
  const ti = useTranslations("catalog.item");
  const router = useRouter();
  const toast = useToast();
  const origin = useOrigin();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "archive" | "delete">(null);

  const isEvent = item.kind === "event";
  const archived = item.state === "archived";
  const on = product.status === "active";
  /* A finished event cannot be put back on sale; everything else can. */
  const canToggle = !archived && item.state !== "ended";
  const online = product.channels.includes("online");
  const slug = slugOf(product);
  const sold = item.event ? eventSold(item.event) : 0;

  const setStatus = async (status: "active" | "inactive") => {
    const res = await updateProduct(product.id, { status });
    if (!res.ok) return toast.error(res.error.message);
    onChanged(res.data);
    return res.data;
  };

  const toggleSale = async () => {
    const was = on;
    setBusy(true);
    const res = await setStatus(was ? "inactive" : "active");
    setBusy(false);
    if (!res) return;
    toast.success(t(was ? "toast.offSaleOne" : "toast.onSaleOne", { name: product.name }), {
      label: t("undo"),
      run: async () => {
        await setStatus(was ? "active" : "inactive");
      },
    });
  };

  const restore = async () => {
    setBusy(true);
    const res = await updateProduct(product.id, { status: "inactive", archivedAt: null } as never);
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    onChanged(res.data);
    toast.success(t("toast.restored", { name: product.name }));
  };

  const doArchive = async () => {
    setBusy(true);
    const res = await archiveProduct(product.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast.error(res.error.message);
    onChanged(res.data);
    toast.success(t("toast.archivedOne", { name: product.name }), {
      label: t("undo"),
      run: async () => {
        const back = await updateProduct(product.id, { status: product.status, archivedAt: null } as never);
        if (back.ok) onChanged(back.data);
      },
    });
  };

  const doDelete = async () => {
    setBusy(true);
    const res = await deleteEvent(product.id);
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast.error(res.error.fieldErrors?.event ?? res.error.message);
    toast.success(te("toast.deleted", { title: product.name }));
    router.push("/catalog");
  };

  const duplicate = async () => {
    setBusy(true);
    if (!isEvent) {
      const res = await createProduct(productCopy(product, t("copyName", { name: product.name })));
      setBusy(false);
      if (!res.ok) return toast.error(res.error.message);
      toast.success(t("toast.duplicated", { name: res.data.name }));
      router.push(`/catalog/${res.data.id}`);
      return;
    }
    const res = await duplicateEvent(product.id, te("copyTitle", { title: product.name }));
    setBusy(false);
    if (!res.ok) return toast.error(res.error.message);
    toast.success(t("toast.duplicated", { name: res.data.title }));
    router.push(`/catalog/${res.data.id}`);
  };

  const copyLink = async () => {
    const ok = await copyText(itemUrl(origin, slug));
    if (ok) toast.success(ti("linkCopied"));
    else toast.error(ti("linkCopyFailed"));
  };

  const menu: ActionMenuItem[] = [];
  if (archived) {
    menu.push({ key: "restore", label: t("action.restore"), icon: <RotateCcw size={14} strokeWidth={1.5} />, onSelect: restore });
    if (isEvent) {
      menu.push({
        key: "delete",
        label: te("action.delete"),
        icon: <Trash2 size={14} strokeWidth={1.5} />,
        destructive: true,
        separated: true,
        disabled: sold > 0,
        hint: sold > 0 ? te("action.deleteBlocked", { count: sold }) : undefined,
        onSelect: () => setConfirm("delete"),
      });
    }
  } else {
    if (online) {
      menu.push({ key: "copy", label: ti("menu.copyLink"), icon: <Link2 size={14} strokeWidth={1.5} />, onSelect: copyLink });
      menu.push({
        key: "view",
        label: ti("menu.viewPage"),
        icon: <SquareArrowOutUpRight size={14} strokeWidth={1.5} />,
        onSelect: () => window.open(`/b/${slug}`, "_blank", "noopener,noreferrer"),
      });
    }
    menu.push({ key: "duplicate", label: t("action.duplicate"), icon: <Copy size={14} strokeWidth={1.5} />, onSelect: duplicate });
    menu.push({ key: "archive", label: t("action.archive"), icon: <Archive size={14} strokeWidth={1.5} />, destructive: true, separated: true, onSelect: () => setConfirm("archive") });
  }

  /* Putting an item on sale is the usual, safe move, so that is the orange
     primary. Stopping sales is the rarer, riskier one: it is a quieter
     secondary button on a desktop and a line in the "…" panel on a phone. */
  const primary = archived
    ? { label: t("action.restore"), icon: <RotateCcw size={16} strokeWidth={1.5} />, onClick: restore, disabled: busy }
    : canToggle && !on
      ? { label: t("action.onSale"), icon: <Eye size={16} strokeWidth={1.5} />, onClick: toggleSale, disabled: busy }
      : undefined;
  const secondary =
    !archived && canToggle && on
      ? { label: t("action.offSale"), icon: <EyeOff size={16} strokeWidth={1.5} />, onClick: toggleSale, disabled: busy }
      : undefined;

  /* Archiving an event people hold tickets for is allowed — it comes off sale
     and the tickets stay good — but it is not a click to make blind, so the
     confirmation names what has been sold and for when. */
  const archiveMessage =
    item.event && sold > 0 && item.state !== "ended"
      ? t("confirm.archiveSoldOne", { count: sold.toLocaleString(), date: formatDay(item.event.startsAt.slice(0, 10)) })
      : t("confirm.archiveBody");

  const dialogs: ReactNode = (
    <ConfirmDialog
      open={confirm !== null}
      onClose={() => setConfirm(null)}
      onConfirm={confirm === "delete" ? doDelete : doArchive}
      loading={busy}
      title={confirm === "delete" ? te("confirm.deleteTitle", { title: product.name }) : t("confirm.archiveOne", { name: product.name })}
      message={confirm === "delete" ? te("confirm.deleteBody") : archiveMessage}
      confirmLabel={confirm === "delete" ? te("action.delete") : t("action.archive")}
    />
  );

  return { primary, secondary, menu, dialogs, busy };
}
