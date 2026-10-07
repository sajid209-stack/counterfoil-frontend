import { redirect } from "next/navigation";

/**
 * /pair is the address a manager reads out: "go to pair". The screen itself
 * lives at /login/pair, where the shell already draws sign-in screens without
 * the tab bar (it decides that by route).
 */
export default async function PairAlias({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  redirect(code ? `/login/pair?code=${encodeURIComponent(code)}` : "/login/pair");
}
