"use client";

import { ErrorScreen } from "@/components/screens/RouteScreens";

/** An error anywhere below the root layout that nothing nearer caught. The
 *  admin has its own (inside its frame); this one covers the till, sign-in and
 *  the public pages, as a whole page. */
export default function RootError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorScreen error={error} retry={unstable_retry} />;
}
