"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Cash tender now happens inline on /pos (no page navigation). This route is
// kept only so any old deep link lands somewhere sane — it bounces to the till.
export default function PaymentRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/pos");
  }, [router]);
  return null;
}
