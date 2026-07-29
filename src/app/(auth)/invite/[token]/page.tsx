"use client";

import { useParams } from "next/navigation";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-major">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>
      <h1 className="type-h1 mt-inline text-2xl">Accept invitation</h1>
      <p className="type-body mt-tight text-[13px] text-neutral-600">
        You&apos;ve been invited to join. Set a password to activate your account.
      </p>
      <p className="mt-tight font-mono text-[11px] text-neutral-400">token: {params.token}</p>

      <div className="mt-major flex flex-col gap-section">
        <div className="flex flex-col gap-tight">
          <label className="type-label text-[12px] text-neutral-600">New password</label>
          <input type="password" placeholder="••••••••" className="h-11 rounded-sm border border-neutral-200 px-comfortable text-sm outline-none focus:border-ink" />
        </div>
        <div className="flex flex-col gap-tight">
          <label className="type-label text-[12px] text-neutral-600">Confirm password</label>
          <input type="password" placeholder="••••••••" className="h-11 rounded-sm border border-neutral-200 px-comfortable text-sm outline-none focus:border-ink" />
        </div>
      </div>

      <button type="button" className="mt-major flex h-11 w-full items-center justify-center rounded-sm bg-ink text-sm font-medium text-paper">
        Activate account
      </button>
    </div>
  );
}
