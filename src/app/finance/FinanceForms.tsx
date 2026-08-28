"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function FinanceForms({
  models,
}: {
  models: { id: string; name: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"income" | "expense">("income");

  // Intäkt
  const [incModel, setIncModel] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incDesc, setIncDesc] = useState("");

  // Utgift
  const [expCategory, setExpCategory] = useState("tools");
  const [expAmount, setExpAmount] = useState("");
  const [expRecurring, setExpRecurring] = useState(false);
  const [expDesc, setExpDesc] = useState("");

  const [saving, setSaving] = useState(false);

  async function submitIncome(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("income").insert({
      model_id: incModel || null,
      amount: Number(incAmount),
      description: incDesc || null,
      source: "manual",
    });
    setSaving(false);
    setIncAmount("");
    setIncDesc("");
    router.refresh();
  }

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await supabase.from("expenses").insert({
      category: expCategory,
      amount: Number(expAmount),
      is_recurring: expRecurring,
      recurring_interval: expRecurring ? "monthly" : null,
      description: expDesc || null,
    });
    setSaving(false);
    setExpAmount("");
    setExpDesc("");
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("income")}
          className={`text-sm px-3 py-1.5 rounded-lg transition ${
            tab === "income"
              ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          + Registrera intäkt
        </button>
        <button
          onClick={() => setTab("expense")}
          className={`text-sm px-3 py-1.5 rounded-lg transition ${
            tab === "expense"
              ? "bg-red-950 text-red-400 border border-red-900"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          + Registrera utgift
        </button>
      </div>

      {tab === "income" ? (
        <form onSubmit={submitIncome} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Modell</label>
            <select
              value={incModel}
              onChange={(e) => setIncModel(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            >
              <option value="">— Välj —</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Belopp (kr)</label>
            <input
              required
              type="number"
              value={incAmount}
              onChange={(e) => setIncAmount(e.target.value)}
              className="w-32 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Beskrivning</label>
            <input
              value={incDesc}
              onChange={(e) => setIncDesc(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <button
            disabled={saving}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
          >
            {saving ? "Sparar…" : "Spara intäkt"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitExpense} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Kategori</label>
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            >
              <option value="tools">Verktyg</option>
              <option value="ads">Annonser</option>
              <option value="salary">Lön</option>
              <option value="other">Övrigt</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Belopp (kr)</label>
            <input
              required
              type="number"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="w-32 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              id="recurring"
              type="checkbox"
              checked={expRecurring}
              onChange={(e) => setExpRecurring(e.target.checked)}
            />
            <label htmlFor="recurring" className="text-xs text-neutral-400">
              Återkommande (månadsvis)
            </label>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Beskrivning</label>
            <input
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm text-white"
            />
          </div>
          <button
            disabled={saving}
            className="rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 transition"
          >
            {saving ? "Sparar…" : "Spara utgift"}
          </button>
        </form>
      )}
    </div>
  );
}
