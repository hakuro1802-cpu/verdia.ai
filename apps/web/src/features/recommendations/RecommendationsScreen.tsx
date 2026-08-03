import { useCallback, useEffect, useState } from "react";
import type { Recommendation } from "@verdia/contracts";
import { apiFetch } from "../../shared/api/client";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";

async function fetchRecommendations(): Promise<Recommendation[]> {
  const body = await apiFetch<{ items: Recommendation[] } | Recommendation>(
    "/recommendations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  if (Array.isArray((body as { items?: Recommendation[] }).items)) {
    return (body as { items: Recommendation[] }).items;
  }
  return [body as Recommendation];
}

export function RecommendationsScreen() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const list = await fetchRecommendations();
      const usable = list.filter((r) => !r.unavailableReason);
      if (list.some((r) => r.unavailableReason) && usable.length === 0) {
        setItems(list);
        setState("unavailable");
        setMessage(list[0]?.unavailableReason ?? "Recommendations unavailable");
        return;
      }
      setItems(usable.length ? usable : list);
      setState(list.length === 0 ? "empty" : "ready");
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Recommendations</p>
          <h1>Care guidance</h1>
          <p className="feature-lede">Evidence-backed suggestions with confidence and alternatives.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <FeatureState state={state} message={message} onRetry={() => void load()}>
        <div className="rec-list">
          {items.map((r) => (
            <article key={r.id} className="rec-card">
              <h2>{r.summary}</h2>
              <p>{r.scientificExplanation}</p>
              <p>
                <strong>Primary:</strong> {r.primary}
              </p>
              {r.alternative ? (
                <p>
                  <strong>Alternative:</strong> {r.alternative}
                </p>
              ) : null}
              <p className="muted">
                Confidence {Math.round(r.confidence * 100)}%
                {r.evidence.length ? ` · ${r.evidence.length} evidence notes` : ""}
              </p>
              {r.potentialRisks.length > 0 ? (
                <ul className="stat-list">
                  {r.potentialRisks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </FeatureState>
    </main>
  );
}
