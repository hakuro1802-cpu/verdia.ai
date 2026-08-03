import { useCallback, useEffect, useState } from "react";
import type { DeviceStatus, TelemetrySample } from "@verdia/contracts";
import type { ApiResult } from "../../shared/api/client";
import { DashboardCard } from "./DashboardCard";
import {
  DEFAULT_DEVICE,
  loadDashboardCards,
  type DashboardCardId,
} from "./dashboardService";

const CARD_IDS: DashboardCardId[] = [
  "overview",
  "devices",
  "farms",
  "weather",
  "sensors",
  "recommendations",
  "notifications",
  "reports",
  "analyses",
];

type CardMap = Record<DashboardCardId, ApiResult<unknown> | null>;

function emptyMap(): CardMap {
  return Object.fromEntries(CARD_IDS.map((id) => [id, null])) as CardMap;
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function sensorLine(latest: TelemetrySample | null): string {
  if (!latest) return "No live sensor sample.";
  const s = latest.sensors;
  const parts: string[] = [];
  if (s.soilMoisturePct != null) parts.push(`Moisture ${s.soilMoisturePct}%`);
  if (s.temperatureC != null) parts.push(`${s.temperatureC}°C`);
  if (s.humidityPct != null) parts.push(`RH ${s.humidityPct}%`);
  if (s.soilPh != null) parts.push(`pH ${s.soilPh}`);
  if (s.waterLevelPct != null) parts.push(`Tank ${s.waterLevelPct}%`);
  return parts.length > 0 ? parts.join(" · ") : "Sensor fields present but values unavailable.";
}

export function DashboardScreen() {
  const [cards, setCards] = useState<CardMap>(emptyMap);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setCards(emptyMap());
    const results = await loadDashboardCards(CARD_IDS, { deviceId: DEFAULT_DEVICE });
    setCards(results);
    setLoading(false);
  }, []);

  const reloadOne = useCallback(async (id: DashboardCardId) => {
    setCards((prev) => ({ ...prev, [id]: null }));
    const results = await loadDashboardCards([id], { deviceId: DEFAULT_DEVICE });
    setCards((prev) => ({ ...prev, [id]: results[id] ?? null }));
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <main className="feature-screen dashboard-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">VERDIA.AI</p>
          <h1>Dashboard</h1>
          <p className="feature-lede">Each card loads independently from live API data.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void loadAll()}>
          Refresh all
        </button>
      </header>

      <div className="dash-grid">
        <DashboardCard
          title="Overview"
          result={cards.overview as ApiResult<{
            deviceCount: number;
            farmCount: number;
            onlineDevices: number;
            latestAlert: string | null;
          }> | null}
          loading={loading && cards.overview === null}
          onRetry={() => void reloadOne("overview")}
          isEmpty={(d) => d.deviceCount === 0 && d.farmCount === 0}
        >
          {(d) => (
            <ul className="stat-list">
              <li>{d.deviceCount} devices</li>
              <li>{d.onlineDevices} online</li>
              <li>{d.farmCount} farms</li>
              <li>{d.latestAlert ?? "No alerts"}</li>
            </ul>
          )}
        </DashboardCard>

        <DashboardCard
          title="Devices"
          result={cards.devices as ApiResult<{ devices: DeviceStatus[] }> | null}
          loading={loading && cards.devices === null}
          onRetry={() => void reloadOne("devices")}
          isEmpty={(d) => !d.devices?.length}
        >
          {(d) => (
            <ul className="stat-list">
              {d.devices.slice(0, 4).map((dev) => (
                <li key={dev.deviceId}>
                  {dev.deviceId} — {dev.online ? "online" : "offline"}
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard
          title="Farms"
          result={cards.farms}
          loading={loading && cards.farms === null}
          onRetry={() => void reloadOne("farms")}
          isEmpty={(d) => {
            const r = asRecord(d);
            const farms = r.farms;
            return !Array.isArray(farms) || farms.length === 0;
          }}
        >
          {(d) => {
            const farms = (asRecord(d).farms as { id: string; name: string }[]) ?? [];
            return (
              <ul className="stat-list">
                {farms.slice(0, 4).map((f) => (
                  <li key={f.id}>{f.name}</li>
                ))}
              </ul>
            );
          }}
        </DashboardCard>

        <DashboardCard
          title="Weather"
          result={cards.weather}
          loading={loading && cards.weather === null}
          onRetry={() => void reloadOne("weather")}
          isEmpty={(d) => {
            const r = asRecord(d);
            return !r.weather && !r.impacts;
          }}
        >
          {(d) => {
            const r = asRecord(d);
            const weather = asRecord(r.weather);
            const impacts = (r.impacts as Array<{ signal: string; suggestedAction: string }>) ?? [];
            return (
              <div className="weather-snippet">
                <p>
                  {String(weather.conditionLabel ?? "Conditions")} ·{" "}
                  {weather.temperatureC != null ? `${weather.temperatureC}°C` : "—"}
                </p>
                <ul className="stat-list">
                  {impacts.slice(0, 2).map((imp) => (
                    <li key={imp.signal}>
                      {imp.signal}: {imp.suggestedAction}
                    </li>
                  ))}
                </ul>
              </div>
            );
          }}
        </DashboardCard>

        <DashboardCard
          title="Sensors"
          result={cards.sensors as ApiResult<{
            status: DeviceStatus | null;
            latest: TelemetrySample | null;
            history: TelemetrySample[];
          }> | null}
          loading={loading && cards.sensors === null}
          onRetry={() => void reloadOne("sensors")}
          isEmpty={(d) => !d.latest}
        >
          {(d) => (
            <div>
              <p>{sensorLine(d.latest)}</p>
              <p className="muted">
                Device {d.status?.deviceId ?? DEFAULT_DEVICE}:{" "}
                {d.status?.online ? "online" : d.status ? "offline" : "status unavailable"}
              </p>
            </div>
          )}
        </DashboardCard>

        <DashboardCard
          title="Recommendations"
          result={cards.recommendations}
          loading={loading && cards.recommendations === null}
          onRetry={() => void reloadOne("recommendations")}
          isEmpty={(d) => {
            const r = asRecord(d);
            if (Array.isArray(r.items)) return r.items.length === 0;
            return !r.summary && !r.primary;
          }}
        >
          {(d) => {
            const r = asRecord(d);
            const items = Array.isArray(r.items) ? r.items : [d];
            const first = asRecord(items[0]);
            return (
              <p>
                {String(first.summary ?? first.primary ?? "Recommendation ready")}
                {typeof first.confidence === "number"
                  ? ` (${Math.round(first.confidence * 100)}% confidence)`
                  : ""}
              </p>
            );
          }}
        </DashboardCard>

        <DashboardCard
          title="Notifications"
          result={cards.notifications}
          loading={loading && cards.notifications === null}
          onRetry={() => void reloadOne("notifications")}
          isEmpty={(d) => {
            const items = asRecord(d).items;
            return !Array.isArray(items) || items.length === 0;
          }}
        >
          {(d) => {
            const items = (asRecord(d).items as { id: string; title: string }[]) ?? [];
            return (
              <ul className="stat-list">
                {items.slice(0, 3).map((n) => (
                  <li key={n.id}>{n.title}</li>
                ))}
              </ul>
            );
          }}
        </DashboardCard>

        <DashboardCard
          title="Reports"
          result={cards.reports}
          loading={loading && cards.reports === null}
          onRetry={() => void reloadOne("reports")}
          isEmpty={(d) => {
            const r = asRecord(d);
            if (Array.isArray(r.items)) return r.items.length === 0;
            return !r.sections;
          }}
        >
          {(d) => {
            const r = asRecord(d);
            const report = Array.isArray(r.items) ? asRecord(r.items[0]) : r;
            return (
              <p>
                {String(report.period ?? "daily")} · {Number(report.dataPointsUsed ?? 0)} data
                points · {String(report.note ?? "Report available")}
              </p>
            );
          }}
        </DashboardCard>

        <DashboardCard
          title="Recent analyses"
          result={cards.analyses}
          loading={loading && cards.analyses === null}
          onRetry={() => void reloadOne("analyses")}
          isEmpty={(d) => {
            const items = asRecord(d).items;
            return !Array.isArray(items) || items.length === 0;
          }}
        >
          {(d) => {
            const items =
              (asRecord(d).items as { id: string; diagnosis: string; plantName: string | null }[]) ??
              [];
            return (
              <ul className="stat-list">
                {items.slice(0, 3).map((a) => (
                  <li key={a.id}>
                    {a.plantName ?? "Plant"} — {a.diagnosis}
                  </li>
                ))}
              </ul>
            );
          }}
        </DashboardCard>
      </div>
    </main>
  );
}
