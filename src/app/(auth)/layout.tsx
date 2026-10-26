import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguagePicker } from "@/components/LocaleProvider";
import { Logo } from "@/components/ui";
import { BrandPanel } from "./_components/BrandPanel";

// Auth shell — a calm form column on the left, a brand panel on the right from
// 1024px. Sign in, sign up, recovery, invite and onboarding all sit in it.
//
// The language is chosen HERE, before anybody has an account: a cashier who
// reads only Bangla meets this screen first, and a language switch that lives
// behind sign-in is a switch they can never reach. On a phone it sits in the
// top bar; from 1024px it moves to the quiet footer.
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("auth.shell");
  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh min-w-0 flex-col px-gutter lg:px-hero">
        <header className="flex items-center justify-between gap-section py-section lg:pt-hero">
          <Link href="/" className="inline-flex min-h-11 items-center"><Logo size={26} /></Link>
          <LanguagePicker showLabel={false} className="w-40 lg:hidden" />
        </header>
        <main className="flex flex-1 items-center justify-center py-major">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-x-major gap-y-tight py-section text-sm text-muted lg:pb-hero">
          <div className="flex items-center gap-major">
            <span>{t("copyright")}</span>
            <Link href="/" className="inline-flex min-h-11 items-center hover:text-fg hover:underline md:min-h-0">{t("start")}</Link>
          </div>
          <LanguagePicker showLabel={false} className="hidden w-40 lg:block" />
        </footer>
      </div>
      <BrandPanel />
    </div>
  );
}
