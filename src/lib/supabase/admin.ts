import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Endast för serverkod (t.ex. webhook-routes). Kringgår RLS helt via service role-nyckeln.
// Importera ALDRIG denna fil i en "use client"-komponent.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
