import { getTranslations } from "next-intl/server";
import { SignInForm } from "./SignInForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default function SignInPage() {
  return <SignInForm />;
}
