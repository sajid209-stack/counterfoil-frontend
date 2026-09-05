"use client";

import { useParams } from "next/navigation";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();

  return (
    <div className="card-surface p-major">
      <p className="type-label text-[13px] text-brand-foreground">Counterfoil</p>
      <h1 className="type-h1 mt-inline text-2xl">Accept invitation</h1>
      <p className="type-body mt-tight text-[13px] text-muted">
        You&apos;ve been invited to join. Set a password to activate your account.
      </p>
      <p className="mt-tight font-mono text-[12px] text-faint">token: {params.token}</p>

      <div className="mt-major flex flex-col gap-section">
        <div className="flex flex-col gap-tight">
          <label className="type-label text-[12px] text-muted">New password</label>
          <input type="password" placeholder="••••••••" className="h-11 rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse" />
        </div>
        <div className="flex flex-col gap-tight">
          <label className="type-label text-[12px] text-muted">Confirm password</label>
          <input type="password" placeholder="••••••••" className="h-11 rounded-sm border border-line px-comfortable text-sm outline-none focus:border-inverse" />
        </div>
      </div>

      <button type="button" className="mt-major flex h-11 w-full items-center justify-center rounded-sm bg-inverse text-sm font-medium text-inverse-fg">
        Activate account
      </button>
    </div>
  );
}
