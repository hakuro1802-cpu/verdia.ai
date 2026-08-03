import { useCallback, useEffect, useState } from "react";
import type { Farm, Field } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { createFarm, listFarms, listFields } from "./farmsService";

export function FarmsScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setMessage(undefined);
    try {
      const items = await listFarms();
      setFarms(items);
      setState(items.length === 0 ? "empty" : "ready");
      setSelected((prev) => prev ?? items[0]?.id ?? null);
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

  useEffect(() => {
    if (!selected) {
      setFields([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const items = await listFields(selected);
        if (!cancelled) setFields(items);
      } catch {
        if (!cancelled) setFields([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const onCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createFarm({ name: name.trim() });
      setName("");
      await load();
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setState(mapped.state);
      setMessage(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="feature-screen">
      <header className="feature-screen__header">
        <div>
          <p className="feature-kicker">Farms</p>
          <h1>Your farms & fields</h1>
          <p className="feature-lede">Manage farms from the live API — no fabricated listings.</p>
        </div>
      </header>

      <div className="farm-create">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New farm name"
          aria-label="New farm name"
        />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onCreate()}>
          Add farm
        </button>
      </div>

      <FeatureState state={state} message={message} onRetry={() => void load()}>
        <div className="split-panels">
          <ul className="entity-list">
            {farms.map((farm) => (
              <li key={farm.id}>
                <button
                  type="button"
                  className={selected === farm.id ? "is-active" : ""}
                  onClick={() => setSelected(farm.id)}
                >
                  <strong>{farm.name}</strong>
                  <span>{farm.locationLabel ?? "No location"}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="entity-detail">
            <h2>Fields</h2>
            {fields.length === 0 ? (
              <FeatureState state="empty" message="No fields for this farm yet." compact />
            ) : (
              <ul className="stat-list">
                {fields.map((f) => (
                  <li key={f.id}>
                    {f.name}
                    {f.crop ? ` · ${f.crop}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </FeatureState>
    </main>
  );
}
