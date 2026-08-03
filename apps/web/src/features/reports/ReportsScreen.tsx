import { useCallback, useEffect, useState } from "react";
import type { ReportPeriod, ReportSummary } from "@verdia/contracts";
import { apiFetch, ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";

async function fetchReports(period: ReportPeriod): Promise<ReportSummary[]> {
  const body = await apiFetch<{ items: ReportSummary[] } | ReportSummary>(
    "/reports",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period }),
    },
  );
  if (Array.isArray((body as { items?: ReportSummary[] }).items)) {
    return (body as { items: ReportSummary[] }).items;
  }
  return [body as ReportSummary];
}

export function ReportsScreen() {
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [items, setItems] = useState<ReportSummary[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const list = await fetchReports(period);
      setItems(list);
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
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Reports</p>
          <h1>Summaries</h1>
          <p className="feature-lede">Period reports built from real data points only.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
          aria-label="Report period"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="seasonal">Seasonal</option>
        </select>
      </header>

      <FeatureState state={state} message={message} onRetry={() => void load()}>
        <div className="report-list">
          {items.map((r) => (
            <article key={r.id} className="report-card">
              <h2>
                {r.period} · {new Date(r.generatedAt).toLocaleString()}
              </h2>
              <p className="muted">
                {r.dataPointsUsed} data points · {r.note}
              </p>
              {r.sections.map((section) => (
                <div key={section.title}>
                  <h3>{section.title}</h3>
                  <ul className="stat-list">
                    {section.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
        </div>
      </FeatureState>
    </main>
  );
}
