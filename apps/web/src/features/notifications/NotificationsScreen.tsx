import { useCallback, useEffect, useState } from "react";
import type { AppNotification } from "@verdia/contracts";
import { apiFetch, ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";

async function fetchNotifications(): Promise<AppNotification[]> {
  const body = await apiFetch<{ items: AppNotification[] } | AppNotification[]>(
    "/notifications",
  );
  return Array.isArray(body) ? body : body.items ?? [];
}

export function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const list = await fetchNotifications();
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Notifications</p>
          <h1>Alerts & updates</h1>
          <p className="feature-lede">Live notifications from the platform API.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      <FeatureState
        state={state}
        message={message}
        onRetry={() => void load()}
        title={state === "empty" ? "No notifications" : undefined}
      >
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.read ? "is-read" : ""}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <p className="muted">
                {n.kind} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </FeatureState>
    </main>
  );
}
