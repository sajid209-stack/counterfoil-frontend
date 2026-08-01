"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, FormField, PageShell, useToast } from "@/components/ui";
import { useApiQuery } from "@/lib/useApi";
import { getStaff, listCounters, listLocations, updateStaff } from "@/lib/api";

const ME = "stf_nadia"; // mock session

const MOCK_DEVICES = [
  { id: "d1", name: "Fort iPad 1", where: "Fort Main Gate", last: "Now" },
  { id: "d2", name: "Chrome on Windows", where: "Office", last: "2 hr ago" },
  { id: "d3", name: "Old Android tablet", where: "—", last: "12 days ago" },
];

// Staff self-service: my own details, my assignments (read-only), my sessions.
export default function ProfilePage() {
  const toast = useToast();
  const meQ = useApiQuery(() => getStaff(ME), []);
  const locationsQ = useApiQuery(() => listLocations({ pageSize: 100 }), []);
  const countersQ = useApiQuery(() => listCounters({ pageSize: 100 }), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [devices, setDevices] = useState(MOCK_DEVICES);

  useEffect(() => {
    if (meQ.data) { setName(meQ.data.name); setEmail(meQ.data.email ?? ""); setPhone(meQ.data.phone ?? ""); }
  }, [meQ.data]);

  const me = meQ.data;
  const card = "rounded-md border border-line bg-card p-major";

  const save = async () => {
    const res = await updateStaff(ME, { name, email: email || null, phone: phone || null });
    if (res.ok) { toast.success("Profile saved."); meQ.reload(); }
    else toast.error(res.error.message);
  };

  return (
    <PageShell title="My profile" description="Your own details — assignments are set by a manager.">
      <div className="flex max-w-3xl flex-col gap-section">
        <div className={card}>
          <div className="mb-section flex items-center gap-section">
            <Avatar name={me?.name ?? "?"} size={56} />
            <div>
              <p className="text-lg font-medium">{me?.name ?? "…"}</p>
              <button type="button" onClick={() => toast.info("Photo upload arrives with the backend — initials stand in.")} className="text-[13px] text-ember underline-offset-4 hover:underline">Change photo</button>
            </div>
          </div>
          <div className="grid gap-section sm:grid-cols-2">
            <FormField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <FormField label="Language" variant="select" value={language} onChange={(e) => setLanguage(e.target.value)} options={[{ value: "en", label: "English" }, { value: "bn", label: "বাংলা" }]} />
            <FormField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button className="mt-section" onClick={save}>Save changes</Button>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Where I work</h2>
          <p className="text-[13px] text-muted">
            Locations: <span className="text-fg">{(me?.locationIds ?? []).map((id) => locationsQ.data?.data.find((l) => l.id === id)?.name ?? id).join(", ") || "—"}</span>
          </p>
          <p className="mt-tight text-[13px] text-muted">
            Counters: <span className="text-fg">{(me?.counterIds ?? []).map((id) => countersQ.data?.data.find((c) => c.id === id)?.name ?? id).join(", ") || "—"}</span>
          </p>
          <p className="mt-tight text-[12px] text-faint">Assignments are managed in Settings → Team.</p>
        </div>

        <div className={card}>
          <h2 className="type-h2 mb-section text-base">Signed-in devices</h2>
          {devices.map((d) => (
            <div key={d.id} className="flex h-12 items-center gap-section border-b border-line text-[13px] last:border-0">
              <span className="min-w-0 flex-1 truncate">{d.name} <span className="text-faint">· {d.where}</span></span>
              <span className="font-mono text-[12px] text-faint">{d.last}</span>
              {d.last === "Now" ? (
                <span className="font-mono text-[11px] text-success">This device</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => { setDevices((x) => x.filter((y) => y.id !== d.id)); toast.success(`${d.name} signed out.`); }}>Sign out</Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
