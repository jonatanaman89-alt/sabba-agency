"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile, canSeeFinanceAndVault } from "@/lib/getProfile";
import { encryptApiKey } from "@/lib/integrations/serverCrypto";
import { verifyDropfansKey, DropfansApiError } from "@/lib/integrations/dropfans";
import { revalidatePath } from "next/cache";

export async function connectDropfans(formData: FormData) {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) {
    return { error: "Du har inte behörighet att göra detta." };
  }

  const modelId = String(formData.get("modelId") || "");
  const apiKey = String(formData.get("apiKey") || "").trim();

  if (!modelId || !apiKey) {
    return { error: "Modell och API-nyckel krävs." };
  }
  if (!apiKey.startsWith("dpfn_")) {
    return { error: "Nyckeln ska börja med dpfn_ — kontrollera att du kopierat rätt." };
  }

  // Verifiera nyckeln mot Dropfans innan vi sparar något.
  try {
    const me = await verifyDropfansKey(apiKey);
    const supabase = await createClient();
    const { encrypted_api_key, iv } = encryptApiKey(apiKey);

    const { error } = await supabase.from("model_integrations").upsert(
      {
        model_id: modelId,
        provider: "dropfans",
        encrypted_api_key,
        iv,
        last_sync_status: "ok",
        last_sync_error: null,
      },
      { onConflict: "model_id,provider" }
    );

    if (error) return { error: error.message };

    revalidatePath("/settings/integrations");
    return { success: true, username: me.username };
  } catch (e) {
    if (e instanceof DropfansApiError) {
      return {
        error:
          e.status === 401
            ? "Nyckeln fungerar inte — kontrollera att den är korrekt kopierad och inte återkallad i Dropfans."
            : `Dropfans svarade med fel (${e.status}).`,
      };
    }
    return { error: "Kunde inte nå Dropfans just nu. Försök igen." };
  }
}

export async function disconnectDropfans(modelId: string) {
  const profile = await requireProfile();
  if (!canSeeFinanceAndVault(profile.role)) return { error: "Behörighet saknas." };

  const supabase = await createClient();
  await supabase
    .from("model_integrations")
    .delete()
    .eq("model_id", modelId)
    .eq("provider", "dropfans");

  revalidatePath("/settings/integrations");
  return { success: true };
}
