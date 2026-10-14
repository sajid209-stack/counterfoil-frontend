"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { StatusScreen } from "./StatusScreen";
import { errorReference } from "./reference";
import { surfaceOf } from "./registry";
import { openPalette } from "./ScreenPreview";

/* The thin client wrappers the route files render: `not-found.tsx` is a server
   file, and the error files are client files that all want the same thing —
   which product am I in (so "home" is right) and a code to quote. */

export function NotFoundScreen({ framed = false }: { framed?: boolean }) {
  const pathname = usePathname();
  const surface = surfaceOf(pathname);
  return <StatusScreen variant="notFound" framed={framed} surface={surface} onSearch={framed && surface === "os" ? openPalette : undefined} />;
}

export function ErrorScreen({
  error,
  retry,
  framed = false,
}: {
  error: Error & { digest?: string };
  /** Next's `unstable_retry`: re-fetches and re-renders the segment. */
  retry: () => void;
  framed?: boolean;
}) {
  const pathname = usePathname();
  useEffect(() => {
    // Whatever reports errors for this app reads the console; the digest
    // matches the server log for an error thrown on the server.
    console.error(error);
  }, [error]);
  return <StatusScreen variant="error" framed={framed} surface={surfaceOf(pathname)} reference={errorReference(error)} onRetry={retry} />;
}
