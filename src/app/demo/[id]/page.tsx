"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadWholeDemo } from "@/lib/api";
import { Logo } from "@/components/ui";

/**
 * A shareable way into a whole-business demo: /demo/doers-club opens the app as
 * The Doers Club and remembers it in this browser, so a link sent to a prospect
 * lands on their business rather than the default seed.
 */
export default function DemoEntry() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    const key = id.split("-")[0];
    loadWholeDemo(key);
    router.replace("/dashboard");
  }, [id, router]);
  return (
    <main className="flex min-h-full items-center justify-center p-gutter">
      <Logo size={30} />
    </main>
  );
}
