import { getTranslations } from "next-intl/server";
import { SignOutMotion } from "./SignOutMotion";

export async function generateMetadata() {
  const t = await getTranslations("auth.signedOut");
  return { title: t("metaTitle") };
}

// Where signing out lands: the logo plays once, then sign-in.
export default function SignedOutPage() {
  return <SignOutMotion />;
}
