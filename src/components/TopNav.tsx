"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/getProfile";

// Alla inloggade användare ser samma meny oavsett roll (owner/leadership/
// staff) — ingen roll-baserad filtrering längre, se canSeeFinanceAndVault
// i getProfile.ts.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Hem", icon: "🏠" },
  { href: "/sales", label: "Sales", icon: "💰" },
  { href: "/models", label: "Modeller", icon: "👥" },
  { href: "/vault", label: "Konton", icon: "🔑" },
  { href: "/finance", label: "Kassa", icon: "🏦" },
  { href: "/settings/integrations", label: "Inställningar", icon: "⚙️" },
] as const;

export function TopNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items = NAV_ITEMS;

  const roleLabel =
    profile.role === "owner"
      ? "Ägare"
      : profile.role === "leadership"
      ? "Ledning"
      : "Personal";

  const initials = profile.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-neutral-950/70 border-b border-white/[0.06]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-16 gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-xs font-bold shadow-lg shadow-indigo-950/50">
              S
            </span>
            <span className="text-white font-semibold tracking-tight">
              SABBA
            </span>
          </Link>

          <nav className="flex items-center gap-1 flex-1 overflow-x-auto">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "text-white"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-lg bg-white/[0.08] ring-1 ring-white/[0.08]" />
                  )}
                  <span className="relative flex items-center gap-1.5">
                    <span aria-hidden className="text-[13px]">
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-medium text-neutral-200">
                {initials}
              </span>
              <div className="text-left leading-tight">
                <p className="text-sm text-white">{profile.full_name}</p>
                <p className="text-[11px] text-neutral-500">{roleLabel}</p>
              </div>
            </div>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:bg-white/[0.06] hover:text-white transition">
                Logga ut
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
