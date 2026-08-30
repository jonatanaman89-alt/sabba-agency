import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  full_name: string;
  role: "owner" | "leadership" | "staff";
};

// OBS: proxy.ts har redan verifierat sessionen (med getClaims(), som
// verifierar JWT:t lokalt utan nätverksanrop) innan denna funktion ens körs.
// Vi använder samma getClaims()-metod här istället för getUser() — det
// sparar ett helt nätverks-round-trip till Supabase Auth-servern på VARJE
// sidladdning, eftersom claims.sub redan är det verifierade user-id:t vi
// behöver för profile-frågan. getUser() (som alltid ringer Auth-servern)
// behövs bara på ställen där vi aktivt vill ha färska user-metadata, inte
// bara ett giltigt id.
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/login");

  return profile as Profile;
}

// Variant som ger tillbaka samma supabase-klient som användes för att hämta
// profilen, så sidor slipper skapa en andra klient och kan starta sina egna
// datafrågor direkt utan ett extra createClient()-steg.
export async function requireProfileWithClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single();

  if (!profile) redirect("/login");

  return { profile: profile as Profile, supabase };
}

export function canSeeFinanceAndVault(role: Profile["role"]) {
  return role === "owner" || role === "leadership";
}
