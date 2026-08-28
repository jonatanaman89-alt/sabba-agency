import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SalesLive } from "./SalesLive";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export default async function SalesPage() {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const supabase = await createClient();

  // Samma tidsfönster som Ekonomi-sidan (kalendermånad) — annars går det
  // aldrig att jämföra totalerna mellan de två sidorna på ett meningsfullt sätt.
  const monthStart = startOfMonth();

  const [{ data: sales }, fxRate] = await Promise.all([
    supabase
      .from("sales")
      .select("id, amount, currency, buyer_ref, received_at, model_id, models(name)")
      .gte("received_at", monthStart)
      .order("received_at", { ascending: false })
      .limit(500),
    fetchUsdToSekRate(),
  ]);

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1">Sales</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-2xl">
        Hämtas automatiskt från varje modells Dropfans-konto (drops, tips och
        prenumerationer). Dropfans har ännu inte riktiga webhooks, så datan
        synkas med jämna mellanrum istället för millisekund för millisekund —
        koppla konton under{" "}
        <a href="/settings/integrations" className="text-indigo-400 hover:text-indigo-300">
          Integrationer
        </a>
        . Beloppen nedan är i USD (Dropfans egen valuta) med en ungefärlig
        SEK-omräkning bredvid — samma period som Ekonomi-sidan (denna månad),
        så de går att jämföra rakt av.
      </p>
      <SalesLive initialSales={(sales ?? []) as any} fxRate={fxRate} />
    </AppShell>
  );
}
