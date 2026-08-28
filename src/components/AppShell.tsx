import { Sidebar } from "@/components/Sidebar";
import type { Profile } from "@/lib/getProfile";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-neutral-950">
      <Sidebar profile={profile} />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
