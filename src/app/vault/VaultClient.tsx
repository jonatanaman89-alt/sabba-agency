"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto/vaultCrypto";

type VaultItem = {
  id: string;
  model_id: string | null;
  service_name: string;
  username: string | null;
  encrypted_secret: string;
  iv: string;
  notes: string | null;
  models: { name: string } | null;
};

export function VaultClient({
  initialItems,
  models,
}: {
  initialItems: VaultItem[];
  models: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [passphrase, setPassphrase] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [service, setService] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [modelId, setModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reveal(item: VaultItem) {
    try {
      const plain = await decryptSecret(
        item.encrypted_secret,
        item.iv,
        passphrase
      );
      setRevealed((prev) => ({ ...prev, [item.id]: plain }));

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from("vault_access_log").insert({
        vault_item_id: item.id,
        accessed_by: user?.id,
        action: "view",
      });
    } catch {
      setError(
        "Kunde inte låsa upp — fel huvudnyckel, eller så sparades posten med en annan nyckel."
      );
    }
  }

  function copy(id: string, value: string) {
    navigator.clipboard.writeText(value);
    supabase.from("vault_access_log").insert({
      vault_item_id: id,
      action: "copy",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { encrypted_secret, iv } = await encryptSecret(secret, passphrase);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error: insertError } = await supabase.from("vault_items").insert({
        service_name: service,
        username: username || null,
        model_id: modelId || null,
        encrypted_secret,
        iv,
        created_by: user?.id,
      });

      if (insertError) throw insertError;

      setService("");
      setUsername("");
      setSecret("");
      setModelId("");
      setFormOpen(false);
      router.refresh();
    } catch {
      setError("Kunde inte spara posten.");
    } finally {
      setSaving(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 max-w-md">
        <label className="block text-sm text-neutral-300 mb-2">
          Ange huvudnyckel för valvet
        </label>
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-white text-sm mb-3"
          placeholder="Huvudnyckel"
        />
        <button
          onClick={() => passphrase && setUnlocked(true)}
          className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm py-2 transition"
        >
          Lås upp
        </button>
        <p className="text-neutral-500 text-xs mt-3">
          Nyckeln finns bara i din webbläsare under sessionen. Fel nyckel ger
          bara ett felmeddelande vid uppvisning — testa gärna på en post du
          redan vet innehållet på.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="mb-4">
        {!formOpen ? (
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 transition"
          >
            + Nytt konto
          </button>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Tjänst
              </label>
              <input
                required
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="OnlyFans, Instagram, Buffer…"
                className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Användarnamn
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Lösenord
              </label>
              <input
                required
                type="text"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">
                Koppla till modell
              </label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
              >
                <option value="">— Ingen —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              disabled={saving}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
            >
              {saving ? "Krypterar & sparar…" : "Spara"}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg text-neutral-400 hover:text-white text-sm px-3 py-1.5 transition"
            >
              Avbryt
            </button>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {initialItems.length === 0 && (
          <p className="text-neutral-500 text-sm px-5 py-6">
            Inga konton sparade ännu.
          </p>
        )}
        {initialItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between px-5 py-3"
          >
            <div>
              <p className="text-white text-sm font-medium">
                {item.service_name}
                {item.models?.name && (
                  <span className="text-neutral-500 font-normal">
                    {" "}
                    — {item.models.name}
                  </span>
                )}
              </p>
              <p className="text-neutral-500 text-xs mt-0.5">
                {item.username || "—"}
              </p>
              {revealed[item.id] && (
                <p className="text-emerald-400 text-sm font-mono mt-1">
                  {revealed[item.id]}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!revealed[item.id] ? (
                <button
                  onClick={() => reveal(item)}
                  className="text-xs text-neutral-400 hover:text-white transition"
                >
                  Visa
                </button>
              ) : (
                <button
                  onClick={() => copy(item.id, revealed[item.id])}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                >
                  Kopiera
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
