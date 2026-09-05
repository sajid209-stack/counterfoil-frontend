"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, FormField } from "@/components/ui";

// Account recovery — the response NEVER reveals whether an account exists.
export default function ForgotPasswordPage() {
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-section px-section py-hero text-center">
        <h1 className="type-h1 text-2xl">Check your messages</h1>
        <p className="type-body text-[13px] text-muted">
          If an account exists for <span className="font-medium">{contact}</span>, a reset
          link is on its way. It expires in one hour.
        </p>
        <p className="text-[12px] text-faint">Nothing arrived? Check spam, or try again in a few minutes.</p>
        <Link href="/sign-in" className="text-[13px] text-ember underline-offset-4 hover:underline">Back to sign in</Link>
        {/* demo shortcut to the reset screen */}
        <Link href="/reset/demo-token" className="font-mono text-[12px] text-faint hover:text-fg">(demo: open the reset link)</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-section px-section py-hero">
      <div>
        <h1 className="type-h1 text-2xl">Reset your password</h1>
        <p className="type-body mt-tight text-[13px] text-muted">Enter the email or phone on the account and we&apos;ll send a reset link.</p>
      </div>
      <FormField label="Email or phone" placeholder="you@business.example" value={contact} onChange={(e) => setContact(e.target.value)} />
      <Button size="lg" fullWidth disabled={!contact.trim()} onClick={() => setSent(true)}>Send reset link</Button>
      <Link href="/sign-in" className="text-center text-[13px] text-faint hover:text-fg">Back to sign in</Link>
    </main>
  );
}
