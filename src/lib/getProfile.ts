import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  full_name: string;
  role: "owner" | "leadership" | "staff";
};

// OBS: proxy.ts (motsvarande middleware) har redan verifierat sessionen
// innan denna funktion ens körs, men den kan inte skicka med resultatet till
// Server Components — därför behöver vi fortfarande ett getUser()-anrop här.
// Det vi KAN undvika är att göra det två gånger eller köra det i onödan
// sekventiellt efter profile-frågan; de körs nu i en enda kedja med minimal
// overhead (getUser() cachar internt per request hos Supabase-klienten).
export async function requireProfile(): Promise<Profile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return profile as Profile;
}

// Variant som ger tillbaka samma supabase-klient som användes för att hämta
// profilen, så sidor slipper skapa en andra klient och kan starta sina egna
// datafrågor direkt utan ett extra createClient()-steg.
export async function requireProfileWithClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { profile: profile as Profile, supabase };
}

export function canSeeFinanceAndVault(role: Profile["role"]) {
  return role === "owner" || role === "leadership";
}
