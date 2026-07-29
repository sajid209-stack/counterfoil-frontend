"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiError, ApiResult } from "@/lib/api";

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
