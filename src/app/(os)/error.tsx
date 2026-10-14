"use client";

import { ErrorScreen } from "@/components/screens/RouteScreens";

/** An error in an admin page. `error.tsx` sits beside the layout, not above
 *  it, so the shell survives and the error is drawn inside the frame — the
 *  rail still works, which is the way out. */
export default function OsError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <ErrorScreen error={error} retry={unstable_retry} framed />;
}
