import { requireProfileWithClient, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { VaultClient } from "./VaultClient";
import { redirect } from "next/navigation";

export default async function VaultPage() {
  const { profile, supabase } = await requireProfileWithClient();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const [{ data: items }, { data: models }] = await Promise.all([
    supabase
      .from("vault_items")
      .select("id, model_id, service_name, username, encrypted_secret, iv, notes, models(name)")
      .order("service_name"),
    supabase.from("models").select("id, name").order("name"),
  ]);

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">
        Konton & lösenord
      </h1>
      <p className="text-neutral-500 text-sm mb-6">
        Synligt direkt för alla i ledningsgruppen — ingen extra huvudnyckel
        behövs. Krypterat i databasen, men olåst automatiskt här i appen.
      </p>
      <VaultClient
        initialItems={(items ?? []) as any}
        models={models ?? []}
      />
    </AppShell>
  );
}
