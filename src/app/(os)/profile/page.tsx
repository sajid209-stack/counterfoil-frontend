"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, Button, FormField, PageShell, useToast } from "@/components/ui";
import { LanguagePicker } from "@/components/LocaleProvider";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listLocations, updateStaff } from "@/lib/api";

const ME = "stf_nadia"; // mock session

const MOCK_DEVICES = [
  { id: "d1", name: "Fort iPad 1", where: "Fort Main Gate", current: true, lastMinutes: 0 },
  { id: "d2", name: "Chrome on Windows", where: "Office", current: false, lastMinutes: 120 },
  { id: "d3", name: "Old Android tablet", where: "—", current: false, lastMinutes: 12 * 1440 },
];

// Staff self-service: my own details, my assignments (read-only), my sessions.
export default function ProfilePage() {
  const t = useTranslations("profile");
  const toast = useToast();
  const lastSeen = (d: (typeof MOCK_DEVICES)[number]) => {
    if (d.current) return t("lastNow");
    if (d.lastMinutes < 60) return t("lastMinAgo", { count: d.lastMinutes });
    if (d.lastMinutes < 1440) return t("lastHrAgo", { count: Math.round(d.lastMinutes / 60) });
    return t("lastDaysAgo", { count: Math.round(d.lastMinutes / 1440) });
  };
  const meQ = useApiQuery(() => getStaff(ME), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [devices, setDevices] = useState(MOCK_DEVICES);

  useEffect(() => {
    if (meQ.data) { setName(meQ.data.name); setEmail(meQ.data.email ?? ""); setPhone(meQ.data.phone ?? ""); }
  }, [meQ.data]);

  const me = meQ.data;
  const card = "card-surface p-major";

  const save = async () => {
    const res = await updateStaff(ME, { name, email: email || null, phone: phone || null });
    if (res.ok) { toast.success(t("saved")); meQ.reload(); }
    else toast.error(res.error.message);
  };

  return (
    <PageShell title={t("title")} description={t("description")}>
      <div className="flex max-w-3xl flex-col gap-section">
        <div className={card}>
          <div className="mb-section flex items-center gap-section">
            <Avatar name={me?.name ?? "?"} size={56} />
            <div>
              <p className="text-lg font-medium">{me?.name ?? "…"}</p>
              <button type="button" onClick={() => toast.info(t("photoInfo"))} className="text-[13px] text-ember underline-offset-4 hover:underline">{t("changePhoto")}</button>
            </div>
          </div>
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label={t("name")} value={name} onChange={(e) => setName(e.target.value)} />
            <FormField label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormField label={t("phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
            {/* Language switches the whole app immediately (device preference). */}
            <LanguagePicker className="self-end" />
          </div>
          <Button className="mt-section" onClick={save}>{t("saveChanges")}</Button>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("whereIWork")}</h2>
          <p className="text-[13px] text-muted">
            {t("locations")}: <span className="text-fg">{(me?.locationIds ?? []).map((id) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? id).join(", ") || "—"}</span>
          </p>
          <p className="mt-tight text-[13px] text-muted">
            {t("counters")}: <span className="text-fg">{(me?.counterIds ?? []).map((id) => countersQ.data?.data.find((c) => c.id === id)?.name ?? id).join(", ") || "—"}</span>
          </p>
          <p className="mt-tight text-[12px] text-faint">{t("assignmentsNote")}</p>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">{t("signedInDevices")}</h2>
          {devices.map((d) => (
            <div key={d.id} className="flex h-12 items-center gap-section border-b border-line text-[13px] last:border-0">
              <span className="min-w-0 flex-1 truncate">{d.name} <span className="text-faint">· {d.where}</span></span>
              <span className="font-mono text-[12px] text-faint">{lastSeen(d)}</span>
              {d.current ? (
                <span className="font-mono text-[12px] text-success">{t("thisDevice")}</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => { setDevices((x) => x.filter((y) => y.id !== d.id)); toast.success(t("signedOut", { name: d.name })); }}>{t("signOut")}</Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
