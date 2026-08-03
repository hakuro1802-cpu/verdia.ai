import { useCallback, useEffect, useState } from "react";
import type { AppMode, PlatformStatus } from "@verdia/contracts";
import { ApiError, apiFetch } from "../api/client";
import { mapErrorToState, type FeatureStateKind } from "../ui/FeatureState";

export type PlatformStatusState = {
  status: PlatformStatus | null;
  mode: AppMode;
  state: FeatureStateKind;
  message?: string;
  refresh: () => void;
};

const FALLBACK_STATUS: PlatformStatus = {
  mode: "live",
  brand: "verdia.ai",
  assistant: "momo.ai",
  firebaseConfigured: false,
  weatherConfigured: false,
  visionConfigured: false,
  simulatorActive: false,
  services: {},
};

export function usePlatformStatus(): PlatformStatusState {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      try {
        const data = await apiFetch<PlatformStatus>("/platform/status");
        if (cancelled) return;
        setStatus(data);
        setState("ready");
        setMessage(undefined);
      } catch (e) {
        if (cancelled) return;
        const err =
          e instanceof ApiError
            ? e
            : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
        const mapped = mapErrorToState(err);
        // Prefer honest LIVE fallback — never imply demo/simulated data without confirmation.
        setStatus({ ...FALLBACK_STATUS });
        setState(mapped.state === "offline" ? "offline" : "unavailable");
        setMessage(mapped.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    status,
    mode: status?.mode ?? "live",
    state,
    message,
    refresh,
  };
}
