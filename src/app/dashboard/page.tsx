import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count: modelCount } = await supabase
    .from("models")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  let last14 = 0;
  let hasFinanceAccess = canSeeFinanceAndVault(profile.role);

  if (hasFinanceAccess) {
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const { data } = await supabase
      .from("sales")
      .select("amount")
      .gte("received_at", since.toISOString());
    last14 = (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  }

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1">
        Hej, {profile.full_name.split(" ")[0]} 👋
      </h1>
      <p className="text-neutral-400 text-sm mb-8">
        Här är läget just nu.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          href="/models"
          className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition"
        >
          <p className="text-neutral-400 text-xs mb-1">Aktiva modeller</p>
          <p className="text-3xl font-semibold text-white">
            {modelCount ?? 0}
          </p>
        </Link>

        {hasFinanceAccess && (
          <Link
            href="/sales"
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition"
          >
            <p className="text-neutral-400 text-xs mb-1">
              Försäljning, senaste 14 dagarna
            </p>
            <p className="text-3xl font-semibold text-white">
              {last14.toLocaleString("sv-SE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USD
            </p>
          </Link>
        )}

        {hasFinanceAccess && (
          <Link
            href="/vault"
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-700 transition"
          >
            <p className="text-neutral-400 text-xs mb-1">Lösenordsvalv</p>
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
