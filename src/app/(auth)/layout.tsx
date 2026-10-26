import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguagePicker } from "@/components/LocaleProvider";
import { Logo } from "@/components/ui";
import { BrandPanel } from "./_components/BrandPanel";
import m from "./_components/auth-motion.module.css";

// Auth shell — a calm form column on the left, the animated product story on
// the right from 1024px. Sign in, sign up, recovery, invite and onboarding all
// sit in it.
//
// The logo lives INSIDE the form block, directly above the heading, so it is
// part of the thing you are filling in rather than a mark stranded in a corner.
//
// The language is chosen HERE, before anybody has an account: a cashier who
// reads only Bangla meets this screen first, and a language switch that lives
// behind sign-in is a switch they can never reach. On a phone it sits in the
// top bar; from 1024px it moves to the quiet footer.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.shell");
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh min-w-0 flex-col">
        <div className={`${m.strip} lg:hidden`} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col px-gutter lg:px-hero">
          <header className="flex items-center justify-end py-section lg:hidden">
            <LanguagePicker showLabel={false} className="w-40" />
          </header>
          <main className="flex flex-1 items-center justify-center py-major">
            <div className="w-full max-w-[22.5rem] md:max-w-[26.5rem] md:rounded-card md:border md:border-line md:bg-card md:p-wide md:shadow-card">
              <Link href="/" className="mb-major inline-flex items-center max-sm:min-h-11 [@media(pointer:coarse)]:min-h-11"><Logo size={22} /></Link>
              {children}
            </div>
          </main>
          <footer className="flex flex-wrap items-center justify-between gap-x-major gap-y-tight py-section text-sm text-muted lg:pb-hero">
            <div className="flex items-center gap-major">
              <span>{t("copyright")}</span>
              <Link href="/" className="inline-flex items-center hover:text-fg hover:underline max-sm:min-h-11 [@media(pointer:coarse)]:min-h-11">{t("start")}</Link>
            </div>
            <LanguagePicker showLabel={false} className="hidden w-40 lg:block" />
          </footer>
        </div>
      </div>
      <BrandPanel />
    </div>
  );
}
