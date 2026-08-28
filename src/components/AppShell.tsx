import { TopNav } from "@/components/TopNav";
import type { Profile } from "@/lib/getProfile";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <TopNav profile={profile} />
      <main className="page-enter max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {children}
      </main>
    </div>
  );
}
