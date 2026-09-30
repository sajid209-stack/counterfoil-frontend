import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button, FormField, Logo } from "@/components/ui";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

// Branded sign-in front door — static shell; wired to the auth flow later.
export default async function SignInPage() {
  const t = await getTranslations("auth.signIn");
  return (
    <div className="card-surface p-card">
      <Logo size={28} />

      <h1 className="type-h1 mt-major text-2xl">{t("title")}</h1>
      <p className="type-body mt-inline text-[13px] text-muted">{t("lead")}</p>

      <div className="mt-major flex flex-col gap-section">
        <FormField label={t("email")} variant="email" autoComplete="email" placeholder={t("emailPlaceholder")} />
        <div className="flex flex-col gap-inline">
          <FormField label={t("password")} variant="password" autoComplete="current-password" />
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center self-start text-[13px] text-brand-foreground underline-offset-4 hover:underline md:min-h-0">
            {t("forgot")}
          </Link>
        </div>
      </div>

      <Button fullWidth size="lg" className="mt-major">
        {t("submit")}
      </Button>

      <p className="type-body mt-section text-center text-[13px] text-muted">
        {t("noAccount")}{" "}
        <Link href="/sign-up" className="text-brand-foreground underline-offset-4 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
      <p className="type-body mt-tight text-center text-[13px]">
        <Link href="/" className="inline-flex min-h-11 items-center text-muted hover:text-fg md:min-h-0">
          {t("back")}
        </Link>
      </p>
    </div>
  );
}
