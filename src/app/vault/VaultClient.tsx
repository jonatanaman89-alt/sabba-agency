"use client";

import { useMemo, useState } from "react";
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
  const [revealingAll, setRevealingAll] = useState(false);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [service, setService] = useState("");
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [modelId, setModelId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialItems;
    return initialItems.filter(
      (item) =>
        item.service_name.toLowerCase().includes(q) ||
        (item.username || "").toLowerCase().includes(q) ||
        (item.models?.name || "").toLowerCase().includes(q)
    );
  }, [initialItems, search]);

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

  function hide(id: string) {
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function revealAll() {
    setError(null);
    setRevealingAll(true);
    try {
      for (const item of filtered) {
        if (!revealed[item.id]) {
          // eslint-disable-next-line no-await-in-loop
          await reveal(item);
        }
      }
    } finally {
      setRevealingAll(false);
    }
  }

  function hideAll() {
    setRevealed({});
  }

  function copy(id: string, value: string) {
    navigator.clipboard.writeText(value);
    supabase.from("vault_access_log").insert({
      vault_item_id: id,
      action: "copy",
    });
  }

  async function startEdit(item: VaultItem) {
    let currentSecret = revealed[item.id];
    if (!currentSecret) {
      try {
        currentSecret = await decryptSecret(
          item.encrypted_secret,
          item.iv,
          passphrase
        );
      } catch {
        setError(
          "Kunde inte låsa upp lösenordet för redigering — fel huvudnyckel?"
        );
        return;
      }
    }
    setEditingId(item.id);
    setService(item.service_name);
    setUsername(item.username || "");
    setSecret(currentSecret);
    setModelId(item.model_id || "");
    setFormOpen(true);
  }

  function resetForm() {
    setEditingId(null);
    setService("");
    setUsername("");
    setSecret("");
    setModelId("");
    setFormOpen(false);
    setError(null);
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

      if (editingId) {
        const { error: updateError } = await supabase
          .from("vault_items")
          .update({
            service_name: service,
            username: username || null,
            model_id: modelId || null,
            encrypted_secret,
            iv,
          })
          .eq("id", editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("vault_items").insert({
          service_name: service,
          username: username || null,
          model_id: modelId || null,
          encrypted_secret,
          iv,
          created_by: user?.id,
        });
        if (insertError) throw insertError;
      }

      resetForm();
      // Efter att ett konto sparats/uppdaterats — hoppa till Kassa (ekonomi),
      // enligt önskat flöde.
      router.push("/finance");
      router.refresh();
    } catch {
      setError("Kunde inte spara posten.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: VaultItem) {
    if (!confirm(`Ta bort "${item.service_name}"? Går inte att ångra.`)) return;
    const { error: deleteError } = await supabase
      .from("vault_items")
      .delete()
      .eq("id", item.id);
    if (deleteError) {
      setError("Kunde inte ta bort posten.");
      return;
    }
    router.refresh();
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

  const anyRevealed = Object.keys(revealed).length > 0;

  return (
    <div>
      {error && (
        <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <button
          onClick={() => (formOpen ? resetForm() : setFormOpen(true))}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 transition"
        >
          {formOpen ? "Avbryt" : "+ Nytt konto"}
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={anyRevealed ? hideAll : revealAll}
            disabled={revealingAll}
            className="rounded-lg border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white text-sm px-4 py-2 transition disabled:opacity-50"
          >
            {revealingAll
              ? "Låser upp…"
              : anyRevealed
              ? "Dölj alla lösenord"
              : "👁 Visa alla lösenord"}
          </button>
        </div>
      </div>

      {formOpen && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3 items-end mb-4"
        >
          <div>
            <label className="block text-xs text-neutral-400 mb-1">
              Tjänst / verktyg
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
              Inloggning
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
            {saving ? "Krypterar & sparar…" : editingId ? "Spara ändringar" : "Spara"}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="rounded-lg text-neutral-400 hover:text-white text-sm px-3 py-1.5 transition"
          >
            Avbryt
          </button>
        </form>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sök på verktyg eller inloggning…"
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-2.5 text-sm text-white mb-4 placeholder:text-neutral-500"
      />

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left">
              <th className="px-5 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide">
                Verktyg / konto
              </th>
              <th className="px-5 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide">
                Inloggning
              </th>
              <th className="px-5 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide">
                Lösenord
              </th>
              <th className="px-5 py-3 text-neutral-500 text-xs font-medium uppercase tracking-wide text-right">
                Åtgärder
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-neutral-500">
                  {initialItems.length === 0
                    ? "Inga konton sparade ännu."
                    : "Inga träffar."}
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-800/40">
                <td className="px-5 py-3 text-white">
                  {item.service_name}
                  {item.models?.name && (
                    <span className="text-neutral-500 font-normal">
                      {" "}
                      — {item.models.name}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-neutral-300">
                  {item.username || "—"}
                </td>
                <td className="px-5 py-3 text-neutral-300 font-mono">
                  {revealed[item.id] ? (
                    <span className="text-emerald-400">
                      {revealed[item.id]}
                    </span>
                  ) : (
                    "••••••••"
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-3">
                    {!revealed[item.id] ? (
                      <button
                        onClick={() => reveal(item)}
                        title="Visa"
                        className="text-neutral-400 hover:text-white transition"
                      >
                        👁
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => copy(item.id, revealed[item.id])}
                          title="Kopiera"
                          className="text-indigo-400 hover:text-indigo-300 transition"
                        >
                          📋
                        </button>
                        <button
                          onClick={() => hide(item.id)}
                          title="Dölj"
                          className="text-neutral-400 hover:text-white transition"
                        >
                          🙈
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => startEdit(item)}
                      title="Redigera"
                      className="text-neutral-400 hover:text-white transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      title="Ta bort"
                      className="text-neutral-400 hover:text-red-400 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
