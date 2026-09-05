"use client";

import { useState } from "react";
import { Button, FormField, StatusPill, useToast } from "@/components/ui";

interface Op { name: string; admin: string; email: string; status: "active" | "invited" }

// Platform-operator console SCAFFOLD — internal, guarded by obscurity for the
// demo, hidden from every nav. Jira component: [APP] Admin Console.
export default function AdminPage() {
  const toast = useToast();
  const [ops, setOps] = useState<Op[]>([
    { name: "Lalbagh Heritage Attractions", admin: "Rahim Uddin", email: "rahim@lalbagh.example", status: "active" },
  ]);
  const [name, setName] = useState("");
  const [admin, setAdmin] = useState("");
  const [email, setEmail] = useState("");

  const create = () => {
    setOps((o) => [...o, { name: name.trim(), admin: admin.trim(), email: email.trim(), status: "invited" }]);
    setName(""); setAdmin(""); setEmail("");
    toast.success("Operator created — the admin invite is on its way.");
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-section bg-surface px-section py-major">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-wider text-ember">Internal · Admin console scaffold</p>
        <h1 className="type-h1 mt-tight text-2xl">Operators</h1>
      </div>

      <div className="card-surface p-major">
        <h2 className="type-h2 mb-section text-base">Create an operator</h2>
        <div className="grid gap-section sm:grid-cols-3">
          <FormField label="Business name" placeholder="Sundarban River Tours" value={name} onChange={(e) => setName(e.target.value)} />
          <FormField label="First admin" placeholder="Full name" value={admin} onChange={(e) => setAdmin(e.target.value)} />
          <FormField label="Admin email" placeholder="owner@business.example" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button className="mt-section" disabled={!name.trim() || !admin.trim() || !email.includes("@")} onClick={create}>Create operator</Button>
      </div>

      <div className="overflow-hidden card-surface">
        {ops.map((o) => (
          <div key={o.name} className="flex h-14 items-center gap-section border-b border-line px-section text-sm last:border-0">
            <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
            <span className="min-w-0 truncate text-muted">{o.admin} · {o.email}</span>
            <StatusPill tone={o.status === "active" ? "success" : "warning"}>{o.status}</StatusPill>
          </div>
        ))}
      </div>
    </main>
  );
}
