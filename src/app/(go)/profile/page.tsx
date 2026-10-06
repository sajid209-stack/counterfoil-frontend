"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut, MapPin, ShieldCheck, Store } from "lucide-react";
import { Avatar } from "@/components/ui";
import { LanguagePicker } from "@/components/LocaleProvider";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listLocations, listRoles, peekCounters } from "@/lib/api";
import { DEMO_STAFF_ID } from "@/lib/session";
import { useActiveCounter } from "@/lib/activeCounter";

/**
 * My profile, at the counter.
 *
 * There was one profile page and it lived in the admin app, while the till's
 * More sheet linked straight to it — so a cashier tapping their own name at
 * the counter landed in the OS shell with Dashboard, Orders, Reports and
 * Settings in front of them, mid-shift. This is the same person's page, in
 * the shape of the surface they are standing at.
 *
 * Read-only on purpose, apart from the two things a cashier genuinely changes
 * at a counter: the language this device speaks, and being the person signed
 * into it. Names, roles and where somebody works are a manager's to set, and
 * they are set in Settings — a till is not the place to discover you can
 * rename yourself.
 */
export default function GoProfilePage() {
  const t = useTranslations("profile");
  const meQ = useApiQuery(() => getStaff(DEMO_STAFF_ID), []);
  const rolesQ = useApiQuery(() => listRoles({ pageSize: 100 }), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);

  const me = meQ.data;
  const role = rolesQ.data?.data.find((r) => r.id === me?.roleId);
  /* Where this device is, rather than everywhere this person may work: the
     counter is the fact a cashier is checking when they open this. */
  const { counter } = useActiveCounter(countersQ.data?.data ?? peekCounters());
  const venue = locationsQ.data?.data.find((l) => l.id === counter?.locationId);

  const card = "go-surface p-comfortable";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-comfortable p-comfortable">
      <h1 className="text-[1.25rem] font-semibold">{t("title")}</h1>

      <div className={`${card} flex items-center gap-comfortable`}>
        <Avatar name={me?.name ?? "?"} size={56} />
        <div className="min-w-0">
          <p className="truncate text-[1.0625rem] font-semibold">{me?.name ?? "…"}</p>
          <p className="text-[0.8125rem] text-muted">{role?.name ?? t("noRole")}</p>
        </div>
      </div>

      <div className={card}>
        <h2 className="text-[0.9375rem] font-semibold">{t("workingAt")}</h2>
        <dl className="mt-tight flex flex-col gap-tight">
          <div className="flex items-center gap-tight">
            <Store size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
            <dt className="sr-only">{t("counter")}</dt>
            <dd className="min-w-0 text-[0.875rem]">{counter?.name ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-tight">
            <MapPin size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-muted" />
            <dt className="sr-only">{t("venue")}</dt>
            <dd className="min-w-0 text-[0.875rem]">{venue?.name ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className={card}>
        {/* The picker's own label is off: this card already names it, and the
            OS label it draws is 12px — below the 13px floor the till holds
            every other piece of text to. */}
        <h2 id="go-language" className="text-[0.9375rem] font-semibold">{t("language")}</h2>
        <p className="mt-inline text-[0.8125rem] text-muted">{t("languageDesc")}</p>
        <div className="mt-tight">
          <LanguagePicker showLabel={false} labelledBy="go-language" />
        </div>
      </div>

      <div className={card}>
        <h2 className="text-[0.9375rem] font-semibold">{t("detailsTitle")}</h2>
        <dl className="mt-tight flex flex-col gap-tight text-[0.875rem]">
          <div className="flex flex-wrap items-baseline gap-x-tight">
            <dt className="text-muted">{t("email")}</dt>
            <dd className="min-w-0 break-all">{me?.email || "—"}</dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-tight">
            <dt className="text-muted">{t("phone")}</dt>
            <dd className="min-w-0">{me?.phone || "—"}</dd>
          </div>
        </dl>
        <p className="mt-tight text-[0.8125rem] text-muted">{t("managerChanges")}</p>
      </div>

      {/* The way out, last and unmistakable: at a counter this is the control
          people actually come here for at the end of a shift. */}
      <Link
        href="/login"
        className="go-surface flex min-h-14 items-center justify-center gap-tight text-[0.9375rem] font-semibold text-brand-foreground active:scale-[0.99]"
      >
        <LogOut size={18} strokeWidth={1.75} aria-hidden />
        {t("switchUser")}
      </Link>

      <p className="flex items-center justify-center gap-inline text-[0.8125rem] text-muted">
        <ShieldCheck size={14} strokeWidth={1.5} aria-hidden />
        {t("pinNote")}
      </p>
    </div>
  );
}
