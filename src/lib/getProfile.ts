import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  full_name: string;
  role: "owner" | "leadership" | "staff";
};

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

export function canSeeFinanceAndVault(role: Profile["role"]) {
  return role === "owner" || role === "leadership";
}
