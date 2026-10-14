"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { LOCALE_COOKIE } from "@/i18n/locale";
import { PREFS_BOOT } from "@/lib/prefsBoot";
import { buttonClass } from "@/components/ui/Button";
import { ScreenArt } from "@/components/screens/ScreenArt";
import { errorReference } from "@/components/screens/reference";
import "./globals.css";

/**
 * The last resort: an error in the root layout itself.
 *
 * It REPLACES the root layout while it is showing, so none of the app is
 * around it — no providers, no translations, no fonts. That is why it carries
 * its own two-language copy, reads the language from the cookie the app wrote,
 * applies the saved theme with the same boot script, and imports the
 * stylesheet itself. Plain elements and token classes only: anything that
 * reaches for a context would throw inside the thing that is catching a throw.
 */
const COPY = {
  en: {
    title: "Something went wrong",
    body: "This is a fault on our side, not yours. Try again. If it keeps happening, tell us the code below.",
    retry: "Try again",
    home: "Go to dashboard",
    help: "Quote this code if you ask for help",
    reference: "Reference code",
    copy: "Copy code",
    copied: "Copied",
  },
  bn: {
    title: "কিছু একটা ভুল হয়েছে",
    body: "এটা আপনার ভুল নয়, আমাদের দিকের সমস্যা। আবার চেষ্টা করুন। বারবার হলে নিচের কোডটি আমাদের জানান।",
    retry: "আবার চেষ্টা করুন",
    home: "ড্যাশবোর্ডে যান",
    help: "সাহায্য চাইলে এই কোডটি বলুন",
    reference: "রেফারেন্স কোড",
    copy: "কোড কপি করুন",
    copied: "কপি হয়েছে",
  },
} as const;

const subscribe = () => () => {};
const readLocale = (): keyof typeof COPY => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return m?.[1] === "bn" ? "bn" : "en";
};

export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  /* The server cannot read the cookie here, so it draws English and the
     browser corrects it — without a hydration mismatch. */
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en" as const);
  const t = COPY[locale];
  const reference = errorReference(error);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Blocked clipboard: the code is on screen to read out instead. */
    }
  };

  return (
    <html lang={locale} suppressHydrationWarning className="h-full">
      <head>
        <title>{t.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} />
      </head>
      <body className="min-h-full bg-surface text-fg antialiased">
        <main role="alert" className="flex min-h-dvh items-center justify-center px-gutter py-hero">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <ScreenArt tone="danger" size="lg" icon={<span className="text-4xl font-semibold">!</span>} />
            <h1 className="mt-major text-2xl font-semibold tracking-title">{t.title}</h1>
            <p className="mt-tight max-w-sm text-base text-muted">{t.body}</p>
            <div className="mt-major flex w-full flex-col gap-tight sm:w-auto sm:flex-row">
              <button type="button" className={buttonClass({ variant: "primary" })} onClick={() => unstable_retry()}>
                {t.retry}
              </button>
              {/* A plain anchor: the router is part of what just failed. */}
              <a href="/dashboard" className={buttonClass({ variant: "secondary", asButton: false })}>
                {t.home}
              </a>
            </div>
            <p className="mt-major text-sm text-muted">{t.help}</p>
            <div className="mt-inline flex items-center gap-tight rounded-control bg-subtle py-inline pl-comfortable pr-inline">
              <span className="sr-only">{t.reference}: </span>
              <code className="font-mono text-sm">{reference}</code>
              <button type="button" onClick={copy} className={buttonClass({ variant: "tertiary", size: "sm" })}>
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
