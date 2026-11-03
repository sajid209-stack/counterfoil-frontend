"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui";

// Same string as SAVE_FAILED_EVENT in lib/api/client.ts, which `@/lib/api` does not export.
const SAVE_FAILED_EVENT = "cf-catalog-save-failed";

/** Browser storage is full: the change is on screen but will not survive a refresh. */
export function SaveFailedToast() {
  const t = useTranslations("catalog.item");
  const toast = useToast();
  useEffect(() => {
    const onFail = () => toast.error(t("storageFull"));
    window.addEventListener(SAVE_FAILED_EVENT, onFail);
    return () => window.removeEventListener(SAVE_FAILED_EVENT, onFail);
  }, [t, toast]);
  return null;
}
