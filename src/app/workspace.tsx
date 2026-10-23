"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type {
  CloudRestaurant,
  Membership,
} from "../server/repositories/tenant.ts";

type Load<T> =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; value: T };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.error || `Request failed (${response.status}).`);
  return body as T;
}
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Request failed.";

// The selected restaurant lives in the URL, so a refresh reloads it from storage.
function selectedFromUrl() {
  return new URL(window.location.href).searchParams.get("restaurant");
}
function selectInUrl(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("restaurant", id);
  window.history.replaceState(null, "", url);
}

export function Workspace() {
  const [workspace, setWorkspace] = useState<Load<Membership>>({ kind: "loading" });
  const [restaurants, setRestaurants] = useState<Load<CloudRestaurant[]>>({ kind: "loading" });
  const [selected, setSelected] = useState<Load<CloudRestaurant> | null>(null);
  const [form, setForm] = useState({ name: "", location: "", website: "", cuisine: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const open = useCallback(async (id: string) => {
    selectInUrl(id);
    setSelected({ kind: "loading" });
    try {
      setSelected({ kind: "ready", value: await api<CloudRestaurant>(`/api/restaurants/${encodeURIComponent(id)}`) });
    } catch (error) {
      setSelected({ kind: "error", message: message(error) });
    }
  }, []);

  const refresh = useCallback(async (workspaceId: string) => {
    try {
      const { restaurants } = await api<{ restaurants: CloudRestaurant[] }>(
        `/api/restaurants?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      setRestaurants({ kind: "ready", value: restaurants });
    } catch (error) {
      setRestaurants({ kind: "error", message: message(error) });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { workspaces } = await api<{ workspaces: Membership[] }>("/api/workspaces");
        if (!workspaces[0]) throw new Error("No workspace is available for this account.");
        setWorkspace({ kind: "ready", value: workspaces[0] });
        await refresh(workspaces[0].workspaceId);
        const saved = selectedFromUrl();
        if (saved) await open(saved);
      } catch (error) {
        setWorkspace({ kind: "error", message: message(error) });
      }
    })();
  }, [open, refresh]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (workspace.kind !== "ready") return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await api<CloudRestaurant>("/api/restaurants", {
        method: "POST",
        body: JSON.stringify({ ...form, workspaceId: workspace.value.workspaceId }),
      });
      setForm({ name: "", location: "", website: "", cuisine: "" });
      await refresh(workspace.value.workspaceId);
      await open(created.id);
    } catch (error) {
      setSaveError(message(error));
    } finally {
      setSaving(false);
    }
  }

  if (workspace.kind === "loading") return <p className="muted">Loading workspace…</p>;
  if (workspace.kind === "error") return <p className="error">{workspace.message}</p>;
  const canWrite = workspace.value.role !== "viewer";

  return (
    <>
      <p className="muted">
        Workspace: {workspace.value.name} ({workspace.value.role})
      </p>
      {canWrite && (
        <section className="panel">
          <h2>Add a restaurant or cafe</h2>
          <form onSubmit={create} className="grid">
            <label>
              Name
              <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              City / address
              <input required maxLength={300} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label>
              Website (optional)
              <input type="url" maxLength={2000} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label>
              Cuisine (optional)
              <input maxLength={120} value={form.cuisine} onChange={(e) => setForm({ ...form, cuisine: e.target.value })} />
            </label>
            <div>
              <button className="button" disabled={saving}>{saving ? "Saving…" : "Save restaurant"}</button>
            </div>
          </form>
          {saveError && <p className="error">{saveError}</p>}
          <p className="muted">
            Entered details are saved as manual input, not verified website evidence.
            Branch search, source collection and analysis are not yet available in the cloud version.
          </p>
        </section>
      )}
      <div className="grid" style={{ alignItems: "start" }}>
        <section className="panel">
          <h2>Restaurants</h2>
          {restaurants.kind === "loading" && <p className="muted">Loading…</p>}
          {restaurants.kind === "error" && <p className="error">{restaurants.message}</p>}
          {restaurants.kind === "ready" && restaurants.value.length === 0 && (
            <p className="muted">No restaurants saved in this workspace yet.</p>
          )}
          {restaurants.kind === "ready" && restaurants.value.length > 0 && (
            <ul className="list">
              {restaurants.value.map((r) => (
                <li key={r.id}>
                  <button
                    aria-current={selected?.kind === "ready" && selected.value.id === r.id}
                    onClick={() => void open(r.id)}
                  >
                    <strong>{r.name}</strong>
                    <br />
                    <span className="muted">{r.location}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Details</h2>
          {!selected && <p className="muted">Select a restaurant.</p>}
          {selected?.kind === "loading" && <p className="muted">Loading…</p>}
          {selected?.kind === "error" && <p className="error">{selected.message}</p>}
          {selected?.kind === "ready" && (
            <dl>
              <dt>Name</dt>
              <dd>{selected.value.name}</dd>
              <dt>Location</dt>
              <dd>{selected.value.location}</dd>
              <dt>Website</dt>
              <dd>{selected.value.website ?? "Not provided"}</dd>
              <dt>Cuisine</dt>
              <dd>{selected.value.cuisine ?? "Unknown"}</dd>
              <dt>Identity source</dt>
              <dd>{selected.value.identitySource}</dd>
              <dt>Saved</dt>
              <dd>{new Date(selected.value.createdAt).toLocaleString()}</dd>
              <dt>ID</dt>
              <dd>{selected.value.id}</dd>
            </dl>
          )}
        </section>
      </div>
    </>
  );
}
