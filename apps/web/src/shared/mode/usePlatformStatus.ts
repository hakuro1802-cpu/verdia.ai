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
  mode: "demo",
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
        const data = await apiFetch<PlatformStatus>("/platform");
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
        // Platform endpoint missing during parallel backend work — still allow shell with DEMO badge.
        setStatus({ ...FALLBACK_STATUS, mode: "demo" });
        setState(mapped.state === "offline" ? "offline" : "ready");
        setMessage(mapped.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tick]);

  return {
    status,
    mode: status?.mode ?? "demo",
    state,
    message,
    refresh,
  };
}
