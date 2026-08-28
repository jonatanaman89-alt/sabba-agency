import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function IntegrationsPage() {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const supabase = await createClient();

  const [{ data: models }, { data: integrations }] = await Promise.all([
    supabase.from("models").select("id, name").order("name"),
    supabase
      .from("model_integrations")
      .select("model_id, provider, last_synced_at, last_sync_status, last_sync_error")
      .eq("provider", "dropfans"),
  ]);

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1">Integrationer</h1>
      <p className="text-neutral-400 text-sm mb-6 max-w-2xl">
        Koppla varje modells Dropfans-konto så att försäljningen dyker upp
        automatiskt i Sales-dashboarden. Nyckeln hämtar ni i Dropfans under{" "}
        <span className="text-neutral-300">Vault → API Connect</span> (välj{" "}
        <span className="text-neutral-300">Personal</span>). Nyckeln lagras
        krypterad och visas aldrig igen efter att den sparats.
      </p>

      <IntegrationsClient
        models={models ?? []}
        integrations={(integrations ?? []) as any}
      />
    </AppShell>
  );
}
