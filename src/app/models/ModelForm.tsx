"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ModelForm() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [alias, setAlias] = useState("");
  const [split, setSplit] = useState("50");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("models").insert({
      name,
      alias: alias || null,
      revenue_split_percent: Number(split),
    });
    setLoading(false);
    if (!error) {
      setName("");
      setAlias("");
      setSplit("50");
      setOpen(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 transition"
      >
        + Ny modell
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 flex flex-wrap gap-3 items-end"
    >
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Namn</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Alias</label>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-neutral-400 mb-1">
          Split % till modell
        </label>
        <input
          type="number"
          min="0"
          max="100"
          value={split}
          onChange={(e) => setSplit(e.target.value)}
          className="w-24 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
        />
      </div>
      <button
        disabled={loading}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
      >
        {loading ? "Sparar…" : "Spara"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-lg text-neutral-400 hover:text-white text-sm px-3 py-1.5 transition"
      >
        Avbryt
      </button>
    </form>
  );
}
