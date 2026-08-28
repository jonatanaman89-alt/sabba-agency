"use client";

import { useState, useTransition } from "react";
import { connectDropfans, disconnectDropfans } from "./actions";

type Model = { id: string; name: string };
type Integration = {
  model_id: string;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
};

export function IntegrationsClient({
  models,
  integrations,
}: {
  models: Model[];
  integrations: Integration[];
}) {
  const byModel = new Map(integrations.map((i) => [i.model_id, i]));

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
      {models.length === 0 && (
        <p className="text-neutral-500 text-sm px-5 py-6">
          Lägg till modeller i CRM:et först, sedan kan ni koppla deras
          Dropfans-konton här.
        </p>
      )}
      {models.map((model) => (
        <ModelIntegrationRow
          key={model.id}
          model={model}
          integration={byModel.get(model.id) ?? null}
        />
      ))}
    </div>
  );
}

function ModelIntegrationRow({
  model,
  integration,
}: {
  model: Model;
  integration: Integration | null;
}) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const connected = !!integration;

  function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const formData = new FormData();
    formData.set("modelId", model.id);
    formData.set("apiKey", apiKey);

    startTransition(async () => {
      const result = await connectDropfans(formData);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `Kopplad till Dropfans-kontot "${result?.username}".`,
        });
        setApiKey("");
        setOpen(false);
      }
    });
  }

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectDropfans(model.id);
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-medium">{model.name}</p>
          {connected ? (
            <p className="text-xs mt-0.5">
              <span
                className={
                  integration?.last_sync_status === "error"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }
              >
                Dropfans kopplat
              </span>
              {integration?.last_synced_at && (
                <span className="text-neutral-500">
                  {" "}
                  · senast synkad{" "}
                  {new Date(integration.last_synced_at).toLocaleString("sv-SE")}
                </span>
              )}
              {integration?.last_sync_status === "error" && (
                <span className="text-amber-400">
                  {" "}
                  · {integration.last_sync_error || "senaste synken misslyckades"}
                </span>
              )}
            </p>
          ) : (
            <p className="text-neutral-500 text-xs mt-0.5">Inte kopplat</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="text-xs text-neutral-400 hover:text-red-400 transition disabled:opacity-50"
            >
              Koppla bort
            </button>
          ) : (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              {open ? "Avbryt" : "+ Koppla Dropfans"}
            </button>
          )}
        </div>
      </div>

      {open && !connected && (
        <form onSubmit={handleConnect} className="mt-3 flex gap-2 items-center">
          <input
            required
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="dpfn_…"
            className="flex-1 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white font-mono"
          />
          <button
            disabled={isPending}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
          >
            {isPending ? "Verifierar…" : "Spara"}
          </button>
        </form>
      )}

      {message && (
        <p
          className={`text-xs mt-2 ${
            message.type === "error" ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
