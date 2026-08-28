import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { VaultClient } from "./VaultClient";
import { redirect } from "next/navigation";

export default async function VaultPage() {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: items } = await supabase
    .from("vault_items")
    .select("id, model_id, service_name, username, encrypted_secret, iv, notes, models(name)")
    .order("service_name");

  const { data: models } = await supabase
    .from("models")
    .select("id, name")
    .order("name");

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1">
        Konton & lösenord
      </h1>
      <p className="text-neutral-400 text-sm mb-6">
        Krypterat med en huvudnyckel som bara ledningsgruppen känner till. Nyckeln
        skickas aldrig till servern — utan den går ingenting att läsa, inte ens från databasen.
      </p>
      <VaultClient
        initialItems={(items ?? []) as any}
        models={models ?? []}
      />
    </AppShell>
  );
}
