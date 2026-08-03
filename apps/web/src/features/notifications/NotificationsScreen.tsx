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

async function markNotificationRead(id: string): Promise<AppNotification> {
  return apiFetch<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [readingId, setReadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    setActionError(null);
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

  const onMarkRead = async (id: string) => {
    if (readingId) return;
    setReadingId(id);
    setActionError(null);
    try {
      const updated = await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not mark as read");
    } finally {
      setReadingId(null);
    }
  };

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

      {actionError ? <p className="field-error">{actionError}</p> : null}

      <FeatureState
        state={state}
        message={message}
        onRetry={() => void load()}
        title={state === "empty" ? "No notifications" : undefined}
      >
        <ul className="notif-list">
          {items.map((n) => (
            <li key={n.id} className={n.read ? "is-read" : ""}>
              <div className="notif-row">
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <p className="muted">
                    {n.kind} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={readingId === n.id || readingId != null}
                    onClick={() => void onMarkRead(n.id)}
                  >
                    {readingId === n.id ? "Marking…" : "Mark as read"}
                  </button>
                ) : (
                  <span className="muted">Read</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </FeatureState>
    </main>
  );
}
