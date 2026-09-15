"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

/** Back and Print, on screen only — the printed page carries nothing but what it prints. */
export function PrintToolbar() {
  const t = useTranslations("ticket");
  const router = useRouter();
  return (
    <div className="mb-major flex items-center justify-between print:hidden">
      <button type="button" onClick={() => router.back()} className="flex min-h-[44px] items-center gap-inline text-[13px] text-muted hover:text-fg">
        <ArrowLeft size={14} strokeWidth={1.5} /> {t("back")}
      </button>
      <Button icon={<Printer size={16} strokeWidth={1.5} />} onClick={() => window.print()}>
        {t("print")}
      </Button>
    </div>
  );
}
