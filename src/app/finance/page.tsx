import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FinanceForms } from "./FinanceForms";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function FinancePage() {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const monthStart = startOfMonth();

  const [{ data: income }, { data: expenses }, { data: models }] =
    await Promise.all([
      supabase
        .from("income")
        .select(
          "amount, occurred_at, description, model_id, source, original_amount, original_currency, fx_rate, models(name)"
        )
        .gte("occurred_at", monthStart)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("expenses")
        .select("amount, category, occurred_at, description, is_recurring")
        .gte("occurred_at", monthStart)
        .order("occurred_at", { ascending: false }),
      supabase.from("models").select("id, name, revenue_split_percent"),
    ]);

  const totalIncome = (income ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const totalExpenses = (expenses ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );
  const margin = totalIncome - totalExpenses;

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1">Ekonomi</h1>
      <p className="text-neutral-400 text-sm mb-6">Denna månad</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-1">Intäkter</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {totalIncome.toLocaleString("sv-SE")} kr
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-1">Utgifter</p>
          <p className="text-2xl font-semibold text-red-400">
            {totalExpenses.toLocaleString("sv-SE")} kr
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-1">Marginal</p>
          <p
            className={`text-2xl font-semibold ${
              margin >= 0 ? "text-white" : "text-red-400"
            }`}
          >
            {margin.toLocaleString("sv-SE")} kr
          </p>
        </div>
      </div>

      <FinanceForms models={models ?? []} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div>
          <h2 className="text-white text-sm font-medium mb-3">
            Intäkter denna månad
          </h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            {(income ?? []).length === 0 && (
              <p className="text-neutral-500 text-sm px-5 py-4">
                Inga intäkter registrerade.
              </p>
            )}
            {(income ?? []).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-white text-sm">
                    {(r as any).models?.name || "Okänd modell"}
                    {r.source === "webhook" && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-indigo-400 bg-indigo-950 border border-indigo-900 rounded-full px-1.5 py-0.5">
                        Dropfans auto
                      </span>
                    )}
                  </p>
                  <p className="text-neutral-500 text-xs">
                    {r.occurred_at} · {r.description || "—"}
                    {r.source === "webhook" && r.original_amount && (
                      <>
                        {" "}
                        · {Number(r.original_amount).toFixed(2)}{" "}
                        {r.original_currency} × {Number(r.fx_rate).toFixed(4)}
                      </>
                    )}
                  </p>
                </div>
                <p className="text-emerald-400 text-sm font-medium">
                  +{Number(r.amount).toLocaleString("sv-SE")} kr
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-white text-sm font-medium mb-3">
            Utgifter denna månad
          </h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            {(expenses ?? []).length === 0 && (
              <p className="text-neutral-500 text-sm px-5 py-4">
                Inga utgifter registrerade.
              </p>
            )}
            {(expenses ?? []).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-white text-sm capitalize">
                    {r.category}
                    {r.is_recurring && (
                      <span className="text-neutral-500 text-xs font-normal">
                        {" "}
                        (återkommande)
                      </span>
                    )}
                  </p>
                  <p className="text-neutral-500 text-xs">
                    {r.occurred_at} · {r.description || "—"}
                  </p>
                </div>
                <p className="text-red-400 text-sm font-medium">
                  −{Number(r.amount).toLocaleString("sv-SE")} kr
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
