import type { ReactNode } from "react";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import type { ApiResult } from "../../shared/api/client";

type Props<T> = {
  title: string;
  result: ApiResult<T> | null;
  loading?: boolean;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => ReactNode;
};

function resolveState<T>(
  result: ApiResult<T> | null,
  loading: boolean | undefined,
  isEmpty?: (data: T) => boolean,
): { state: FeatureStateKind; message?: string } {
  if (loading || result === null) return { state: "loading" };
  if (!result.ok) {
    return mapErrorToState(result.error);
  }
  if (isEmpty?.(result.data)) {
    return { state: "empty" };
  }
  return { state: "ready" };
}

export function DashboardCard<T>({
  title,
  result,
  loading,
  onRetry,
  isEmpty,
  children,
}: Props<T>) {
  const { state, message } = resolveState(result, loading, isEmpty);

  return (
    <article className="dash-card">
      <header className="dash-card__header">
        <h2>{title}</h2>
      </header>
      <div className="dash-card__body">
        <FeatureState state={state} message={message} onRetry={onRetry} compact>
          {result?.ok ? children(result.data) : null}
        </FeatureState>
      </div>
    </article>
  );
}
