"use client";

import { usePathname } from "next/navigation";
import { PageSkeleton } from "@/components/screens/PageSkeleton";
import { resolveScreen } from "@/components/screens/registry";

/** What an admin page shows while it streams in: its own skeleton, picked by
 *  route from the screen registry, inside the frame the shell already drew. */
export default function OsLoading() {
  const shape = resolveScreen(usePathname()).shape;
  return <PageSkeleton shape={shape} />;
}
