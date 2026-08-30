import { requireProfileWithClient, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { redirect } from "next/navigation";
import { FinanceForms } from "./FinanceForms";
import { resolveDateRange } from "@/lib/dateRange";

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { profile, supabase } = await requireProfileWithClient();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const params = await searchParams;
  const range = resolveDateRange(params);

  // Listvyerna begränsas till 1000 rader (skydd mot att ett brett eget
  // datumintervall drar in tusentals rader i en enda request — särskilt
  // relevant nu när historiken är fullständigt backfyllad från Dropfans).
  // Totalsummorna hämtas separat och UTAN limit, så de alltid stämmer även
  // om listvyn är avkortad — annars skulle "Intäkter"-kortet tyst visa fel
  // summa (bara de första 1000 raderna) för breda intervall.
  const LIST_LIMIT = 1000;

  const [
    { data: income },
    { data: expenses },
    { data: models },
    { data: allIncomeAmounts },
    { data: allExpenseAmounts },
  ] = await Promise.all([
    supabase
      .from("income")
      .select(
        "amount, occurred_at, description, model_id, source, original_amount, original_currency, fx_rate, models(name)"
      )
      .gte("occurred_at", range.fromDate)
      .lte("occurred_at", range.toDate)
      .order("occurred_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("expenses")
      .select("amount, category, occurred_at, description, is_recurring")
      .gte("occurred_at", range.fromDate)
      .lte("occurred_at", range.toDate)
      .order("occurred_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase.from("models").select("id, name, revenue_split_percent"),
    supabase
      .from("income")
      .select("amount")
      .gte("occurred_at", range.fromDate)
      .lte("occurred_at", range.toDate),
    supabase
      .from("expenses")
      .select("amount")
      .gte("occurred_at", range.fromDate)
      .lte("occurred_at", range.toDate),
  ]);

  const totalIncome = (allIncomeAmounts ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );
  const totalExpenses = (allExpenseAmounts ?? []).reduce(
    (s, r) => s + Number(r.amount),
    0
  );
  const listIsTruncated =
    (income?.length ?? 0) >= LIST_LIMIT || (expenses?.length ?? 0) >= LIST_LIMIT;
  const margin = totalIncome - totalExpenses;
  const marginPct = totalIncome > 0 ? (margin / totalIncome) * 100 : 0;

  return (
    <AppShell profile={profile}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">
            Ekonomi
          </h1>
          <p className="text-neutral-500 text-sm">
            {range.fromDate === range.toDate
              ? range.fromDate
              : `${range.fromDate} – ${range.toDate}`}
          </p>
        </div>
        <DateRangeFilter activeKey={range.key} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
            Intäkter
          </p>
          <p className="text-3xl font-semibold text-emerald-400 tracking-tight">
            {totalIncome.toLocaleString("sv-SE", { maximumFractionDigits: 0 })}{" "}
            <span className="text-lg font-normal text-emerald-400/70">kr</span>
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-red-500/[0.08] to-transparent p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
          <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
            Utgifter
          </p>
          <p className="text-3xl font-semibold text-red-400 tracking-tight">
            {totalExpenses.toLocaleString("sv-SE", { maximumFractionDigits: 0 })}{" "}
            <span className="text-lg font-normal text-red-400/70">kr</span>
          </p>
        </div>
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
          <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
            Marginal
          </p>
          <p
            className={`text-3xl font-semibold tracking-tight ${
              margin >= 0 ? "text-white" : "text-red-400"
            }`}
          >
            {margin.toLocaleString("sv-SE", { maximumFractionDigits: 0 })}{" "}
            <span className="text-lg font-normal opacity-70">kr</span>
          </p>
          {totalIncome > 0 && (
            <p className="text-neutral-500 text-xs mt-1">
              {marginPct.toFixed(1)}% marginal
            </p>
          )}
        </div>
      </div>

      <FinanceForms models={models ?? []} />

      {listIsTruncated && (
        <p className="text-amber-400/80 text-xs mt-6 -mb-2">
          Visar de {LIST_LIMIT} senaste posterna för perioden — summorna ovan
          räknar dock alltid med samtliga. Välj ett smalare datumintervall
          för att se hela listan.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div>
          <h2 className="text-white text-sm font-medium mb-3">
            Intäkter · {range.label.toLowerCase()}
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06] max-h-[520px] overflow-y-auto">
            {(income ?? []).length === 0 && (
              <p className="text-neutral-500 text-sm px-5 py-4">
                Inga intäkter registrerade.
              </p>
            )}
            {(income ?? []).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
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
            Utgifter · {range.label.toLowerCase()}
          </h2>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06] max-h-[520px] overflow-y-auto">
            {(expenses ?? []).length === 0 && (
              <p className="text-neutral-500 text-sm px-5 py-4">
                Inga utgifter registrerade.
              </p>
            )}
            {(expenses ?? []).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
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
