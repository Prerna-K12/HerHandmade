import { useCallback, useEffect, useState } from "react";

// Loads data when the page opens and again every `pollMs` (0 = never).
// Returns { data, error, loading, reload }. This is the app's "live update":
// a refresh every 30 seconds, plus a Refresh button where it matters.
export default function usePolling(loader, deps = [], pollMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  const reload = useCallback(() => {
    return loader().then(
      (data) => setState({ data, error: null, loading: false }),
      (error) => setState((s) => ({ data: s.data, error, loading: false }))
    );
  }, deps);

  useEffect(() => {
    reload();
    if (!pollMs) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, pollMs);
    return () => clearInterval(timer);
  }, [reload, pollMs]);

  return { ...state, reload };
}
