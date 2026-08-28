"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Fel e-post eller lösenord.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-base font-bold shadow-lg shadow-indigo-950/50 mb-3">
            S
          </span>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            SABBA
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Ledningssystem</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 space-y-4 shadow-2xl shadow-black/40"
        >
          <div>
            <label className="block text-sm text-neutral-300 mb-1">
              E-post
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="namn@sabba.se"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-300 mb-1">
              Lösenord
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-2 transition"
          >
            {loading ? "Loggar in…" : "Logga in"}
          </button>
        </form>

        <p className="text-center text-neutral-500 text-xs mt-4">
          Konton skapas av admin i Supabase. Kontakta ledningen om du saknar
          inloggning.
        </p>
      </div>
    </div>
  );
}
