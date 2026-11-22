"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, ApiResult } from "@/lib/api";

/** Kept in step with lib/api/client STORE_SYNC_EVENT (not imported: this hook
 *  must not pull the mock store into every bundle that fetches). */
const STORE_SYNC_EVENT = "cf-store-sync";

/** Run an ApiResult-returning function and track loading/data/error. Re-runs
 *  when `deps` change. This is the standard client data-fetching pattern for
 *  every screen — swap the mock for real fetch in lib/api and nothing here
 *  changes. */
export function useApiQuery<T>(
  run: () => Promise<ApiResult<T>>,
  deps: unknown[],
): {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => void;
} {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<ApiError | undefined>();
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /* Another tab changed the data (a sale at the till while Orders is open):
     read again, so both screens show the same sales. */
  useEffect(() => {
    window.addEventListener(STORE_SYNC_EVENT, reload);
    return () => window.removeEventListener(STORE_SYNC_EVENT, reload);
  }, [reload]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    run().then((res) => {
      if (!alive) return;
      if (res.ok) {
        setData(res.data);
        setError(undefined);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload };
}
