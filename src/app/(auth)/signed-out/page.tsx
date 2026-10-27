import { getTranslations } from "next-intl/server";
import { SignInForm } from "../sign-in/SignInForm";

export async function generateMetadata() {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

// Where signing out lands: the sign-in page, with the logo played over it once
// by the auth layout's SignOutIntro, which then moves the address to /sign-in.
export default function SignedOutPage() {
  return <SignInForm />;
}
