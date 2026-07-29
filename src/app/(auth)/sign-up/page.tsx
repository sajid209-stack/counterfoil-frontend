"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function SignUpPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"form" | "verify">("form");

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-major">
      <p className="type-label text-[13px] text-ember">Counterfoil</p>

      {phase === "form" ? (
        <>
          <h1 className="type-h1 mt-inline text-2xl">Create your account</h1>
          <p className="type-body mt-tight text-[13px] text-neutral-600">
            We&apos;ll email you a code to confirm it&apos;s you.
          </p>
          <div className="mt-major flex flex-col gap-section">
            {[
              { label: "Your name", type: "text", ph: "Rahim Uddin" },
              { label: "Work email", type: "email", ph: "you@business.com" },
              { label: "Password", type: "password", ph: "At least 8 characters" },
            ].map((f) => (
              <div key={f.label} className="flex flex-col gap-tight">
                <label className="type-label text-[12px] text-neutral-600">{f.label}</label>
                <input type={f.type} placeholder={f.ph} className="h-11 rounded-sm border border-neutral-200 px-comfortable text-sm outline-none focus:border-ink" />
              </div>
            ))}
          </div>
          <Button fullWidth className="mt-major" onClick={() => setPhase("verify")}>
            Create account
          </Button>
          <p className="type-body mt-section text-center text-[13px] text-neutral-400">
            Already have one? <Link href="/sign-in" className="text-ember hover:underline">Sign in</Link>
          </p>
        </>
      ) : (
        <>
          <h1 className="type-h1 mt-inline text-2xl">Check your email</h1>
          <p className="type-body mt-tight text-[13px] text-neutral-600">
            Enter the 6-digit code we sent to confirm your email.
          </p>
          <div className="mt-major flex flex-col gap-tight">
            <label className="type-label text-[12px] text-neutral-600">Verification code</label>
            <input inputMode="numeric" placeholder="000000" className="h-12 rounded-sm border border-neutral-200 px-comfortable text-center font-mono text-lg outline-none focus:border-ink" />
          </div>
          <Button fullWidth className="mt-major" onClick={() => router.push("/onboarding")}>
            Confirm email
          </Button>
          <button type="button" onClick={() => setPhase("form")} className="mt-section w-full text-center text-[13px] text-neutral-400 hover:text-ink">
            Back
          </button>
        </>
      )}
    </div>
  );
}
