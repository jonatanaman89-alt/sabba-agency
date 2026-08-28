import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { ModelForm } from "./ModelForm";
import { ModelRow } from "./ModelRow";

export default async function ModelsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const canEdit = canSeeFinanceAndVault(profile.role);

  const { data: models } = await supabase
    .from("models")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AppShell profile={profile}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Modeller</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Profiler, status och intäktsandel.
          </p>
        </div>
      </div>

      {canEdit && (
        <div className="mb-6">
          <ModelForm />
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {(models ?? []).length === 0 && (
          <p className="text-neutral-500 text-sm px-5 py-6">
            Inga modeller ännu.
          </p>
        )}
        {(models ?? []).map((m) => (
          <ModelRow key={m.id} model={m} canEdit={canEdit} />
        ))}
      </div>
    </AppShell>
  );
}
