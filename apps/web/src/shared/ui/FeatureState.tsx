import type { ReactNode } from "react";

export type FeatureStateKind =
  | "loading"
  | "empty"
  | "error"
  | "offline"
  | "unavailable"
  | "ready";

export type FeatureStateProps = {
  state: FeatureStateKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
  compact?: boolean;
};

const DEFAULTS: Record<Exclude<FeatureStateKind, "ready">, { title: string; message: string }> = {
  loading: { title: "Loading", message: "Fetching live data…" },
  empty: { title: "No data yet", message: "Nothing to show here right now." },
  error: { title: "Something went wrong", message: "We could not load this feature." },
  offline: { title: "You are offline", message: "Reconnect and try again." },
  unavailable: {
    title: "Unavailable",
    message: "This service is not available right now.",
  },
};

export function FeatureState({
  state,
  title,
  message,
  onRetry,
  children,
  compact,
}: FeatureStateProps) {
  if (state === "ready") {
    return <>{children}</>;
  }

  const defaults = DEFAULTS[state];
  const heading = title ?? defaults.title;
  const body = message ?? defaults.message;
  const showRetry = Boolean(onRetry) && state !== "loading";

  return (
    <div
      className={`feature-state feature-state--${state}${compact ? " feature-state--compact" : ""}`}
      role={state === "error" || state === "offline" ? "alert" : "status"}
      aria-live="polite"
    >
      <p className="feature-state__label">{state}</p>
      <h3 className="feature-state__title">{heading}</h3>
      <p className="feature-state__message">{body}</p>
      {showRetry ? (
        <button type="button" className="feature-state__retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function mapErrorToState(error: {
  offline?: boolean;
  status?: number;
  code?: string;
  message?: string;
}): { state: Exclude<FeatureStateKind, "ready" | "loading" | "empty">; message: string } {
  if (error.offline || error.code === "offline") {
    return { state: "offline", message: error.message ?? "You appear to be offline." };
  }
  if (error.status === 503 || error.code === "unavailable") {
    return {
      state: "unavailable",
      message: error.message ?? "Service unavailable.",
    };
  }
  return { state: "error", message: error.message ?? "Request failed." };
}
