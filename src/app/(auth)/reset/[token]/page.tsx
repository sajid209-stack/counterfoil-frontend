"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, FormField, useToast } from "@/components/ui";

// Set a new password. Expired or used tokens get a clear state, not an error.
export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const dead = token === "expired" || token === "used";
  if (dead) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-section px-section py-hero text-center">
        <h1 className="type-h1 text-2xl">{token === "used" ? "Link already used" : "Link expired"}</h1>
        <p className="type-body text-[13px] text-muted">
          {token === "used"
            ? "This reset link has already set a password. If that wasn't you, request another straight away."
            : "Reset links last one hour. Request a fresh one and try again."}
        </p>
        <Link href="/forgot-password"><Button size="lg" fullWidth>Request another link</Button></Link>
      </main>
    );
  }

  const mismatch = pw2.length > 0 && pw !== pw2;
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-section px-section py-hero">
      <div>
        <h1 className="type-h1 text-2xl">Choose a new password</h1>
        <p className="type-body mt-tight text-[13px] text-muted">At least 8 characters. You&apos;ll be signed out of every device.</p>
      </div>
      <FormField label="New password" variant="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <FormField label="Repeat it" variant="password" value={pw2} onChange={(e) => setPw2(e.target.value)} error={mismatch ? "Passwords don't match." : undefined} />
      <Button size="lg" fullWidth disabled={pw.length < 8 || pw !== pw2} onClick={() => { toast.success("Password set — signed out of all devices."); router.push("/sign-in"); }}>
        Set password
      </Button>
    </main>
  );
}
