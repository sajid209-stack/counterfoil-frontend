import type { Metadata } from "next";
import { LanguagePicker } from "@/components/LocaleProvider";
import { StatusScreen } from "@/components/screens/StatusScreen";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Signed out" };

/**
 * Where the app sends someone whose sign-in has run out.
 *
 * A page of its own rather than a banner over whatever they were doing: their
 * screen can no longer be trusted to save, so the honest thing is to stop,
 * say so and offer the one way forward. Standalone on purpose — no rail, no
 * bar, nothing that needs a session — and bilingual, with the language switch
 * on the page, because a cashier who reads only Bangla meets this screen
 * without having signed in to find the setting.
 */
export default function SessionExpiredPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between gap-section px-gutter py-section">
        <Logo />
        <LanguagePicker showLabel={false} className="w-52" />
      </header>
      <main className="flex flex-1 items-center justify-center">
        <StatusScreen variant="sessionExpired" framed />
      </main>
    </div>
  );
}
