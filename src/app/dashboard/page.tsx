import { requireProfileWithClient, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";
import Link from "next/link";

export default async function DashboardPage() {
  const { profile, supabase } = await requireProfileWithClient();

  const hasFinanceAccess = canSeeFinanceAndVault(profile.role);

  const [{ count: modelCount }, financeData] = await Promise.all([
    supabase
      .from("models")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    hasFinanceAccess
      ? (async () => {
          const since = new Date();
          since.setDate(since.getDate() - 14);
          const [{ data }, fxRate] = await Promise.all([
            supabase
              .from("sales")
              .select("amount")
              .gte("received_at", since.toISOString()),
            fetchUsdToSekRate(),
          ]);
          const last14Usd = (data ?? []).reduce(
            (sum, r) => sum + Number(r.amount),
            0
          );
          return last14Usd * fxRate;
        })()
      : Promise.resolve(0),
  ]);

  const last14Sek = financeData;

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">
        Hej, {profile.full_name.split(" ")[0]} 👋
      </h1>
      <p className="text-neutral-500 text-sm mb-8">Här är läget just nu.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/models"
          className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition" />
          <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
            Aktiva modeller
          </p>
          <p className="text-3xl font-semibold text-white tracking-tight">
            {modelCount ?? 0}
          </p>
        </Link>

        {hasFinanceAccess && (
          <Link
            href="/sales"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 hover:border-white/[0.12] transition"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl" />
            <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Försäljning, senaste 14 dagarna
            </p>
            <p className="text-3xl font-semibold text-white tracking-tight">
              {last14Sek.toLocaleString("sv-SE", {
                maximumFractionDigits: 0,
              })}{" "}
              <span className="text-lg font-normal opacity-70">kr</span>
            </p>
          </Link>
        )}

        {hasFinanceAccess && (
          <Link
            href="/vault"
            className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.12] hover:bg-white/[0.04] transition"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition" />
            <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
              Lösenordsvalv
            </p>
            <p className="text-sm text-neutral-300 mt-2">
              Öppna konton & inloggningar →
            </p>
          </Link>
        )}
      </div>

      {!hasFinanceAccess && (
        <p className="text-neutral-500 text-sm mt-8">
          Ekonomi och lösenord är synligt för ledningsgruppen. Kontakta din
          chef om du behöver åtkomst.
        </p>
      )}
    </AppShell>
  );
}
