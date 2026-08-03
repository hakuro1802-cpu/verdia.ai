import { useCallback, useEffect, useState } from "react";
import type { Farm, Field } from "@verdia/contracts";
import { ApiError } from "../../shared/api/client";
import { FeatureState, mapErrorToState, type FeatureStateKind } from "../../shared/ui/FeatureState";
import { createFarm, createField, listFarms, listFields } from "./farmsService";

export function FarmsScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [state, setState] = useState<FeatureStateKind>("loading");
  const [message, setMessage] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldCrop, setFieldCrop] = useState("");
  const [fieldNameError, setFieldNameError] = useState<string | null>(null);
  const [fieldsState, setFieldsState] = useState<FeatureStateKind>("ready");
  const [fieldsMessage, setFieldsMessage] = useState<string | undefined>();
  const [busyFarm, setBusyFarm] = useState(false);
  const [busyField, setBusyField] = useState(false);

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

  const loadFields = useCallback(async (farmId: string) => {
    setFieldsState("loading");
    setFieldsMessage(undefined);
    try {
      const items = await listFields(farmId);
      setFields(items);
      setFieldsState(items.length === 0 ? "empty" : "ready");
      if (items.length === 0) {
        setFieldsMessage("No fields for this farm yet.");
      }
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setFields([]);
      setFieldsState(mapped.state);
      setFieldsMessage(mapped.message);
    }
  }, []);

  useEffect(() => {
    if (!selected) {
      setFields([]);
      setFieldsState("ready");
      return;
    }
    void loadFields(selected);
  }, [selected, loadFields]);

  const onCreateFarm = async () => {
    if (busyFarm) return;
    if (!name.trim()) {
      setNameError("Farm name is required.");
      return;
    }
    setNameError(null);
    setBusyFarm(true);
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
      setBusyFarm(false);
    }
  };

  const onCreateField = async () => {
    if (!selected || busyField) return;
    if (!fieldName.trim()) {
      setFieldNameError("Field name is required.");
      return;
    }
    setFieldNameError(null);
    setBusyField(true);
    try {
      await createField(selected, {
        name: fieldName.trim(),
        crop: fieldCrop.trim() || null,
      });
      setFieldName("");
      setFieldCrop("");
      await loadFields(selected);
    } catch (e) {
      const err =
        e instanceof ApiError
          ? e
          : new ApiError(e instanceof Error ? e.message : "Failed", { status: 0 });
      const mapped = mapErrorToState(err);
      setFieldsState(mapped.state);
      setFieldsMessage(mapped.message);
    } finally {
      setBusyField(false);
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
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder="New farm name"
          aria-label="New farm name"
          aria-invalid={Boolean(nameError)}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={busyFarm || !name.trim()}
          onClick={() => void onCreateFarm()}
        >
          {busyFarm ? "Adding…" : "Add farm"}
        </button>
      </div>
      {nameError ? <p className="field-error">{nameError}</p> : null}

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
            {selected ? (
              <>
                <div className="farm-create">
                  <input
                    value={fieldName}
                    onChange={(e) => {
                      setFieldName(e.target.value);
                      if (fieldNameError) setFieldNameError(null);
                    }}
                    placeholder="New field name"
                    aria-label="New field name"
                    aria-invalid={Boolean(fieldNameError)}
                  />
                  <input
                    value={fieldCrop}
                    onChange={(e) => setFieldCrop(e.target.value)}
                    placeholder="Crop (optional)"
                    aria-label="Crop optional"
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyField || !fieldName.trim()}
                    onClick={() => void onCreateField()}
                  >
                    {busyField ? "Adding…" : "Add field"}
                  </button>
                </div>
                {fieldNameError ? <p className="field-error">{fieldNameError}</p> : null}
              </>
            ) : null}

            <FeatureState
              state={fieldsState}
              message={fieldsMessage}
              onRetry={selected ? () => void loadFields(selected) : undefined}
              compact
            >
              <ul className="stat-list">
                {fields.map((f) => (
                  <li key={f.id}>
                    {f.name}
                    {f.crop ? ` · ${f.crop}` : ""}
                  </li>
                ))}
              </ul>
            </FeatureState>
          </div>
        </div>
      </FeatureState>
    </main>
  );
}
