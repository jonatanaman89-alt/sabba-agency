import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SalesLive } from "./SalesLive";

export default async function SalesPage() {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data: sales } = await supabase
    .from("sales")
    .select("id, amount, currency, buyer_ref, received_at, model_id, models(name)")
    .gte("received_at", since.toISOString())
    .order("received_at", { ascending: false })
    .limit(200);

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
        . Så fort en ny rad landar i databasen dyker den upp här direkt, utan
        att någon behöver ladda om sidan.
      </p>
      <SalesLive initialSales={(sales ?? []) as any} />
    </AppShell>
  );
}
