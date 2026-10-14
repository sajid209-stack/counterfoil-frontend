"use client";

import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/screens/PageSkeleton";
import { resolveScreen } from "@/components/screens/registry";

/** What a till screen shows while it streams in: its own skeleton, picked by
 *  route from the screen registry, inside the frame the shell already drew.
 *  A route the registry does not know gets the generic till list. */
export default function GoLoading() {
  const shape = resolveScreen(usePathname()).shape;
  return <PageSkeleton shape={shape} />;
}
