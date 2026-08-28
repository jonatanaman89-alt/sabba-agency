"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/getProfile";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Hem", icon: "🏠", roles: ["owner", "leadership", "staff"] },
  { href: "/sales", label: "Sales", icon: "💰", roles: ["owner", "leadership"] },
  { href: "/models", label: "Modeller", icon: "👥", roles: ["owner", "leadership", "staff"] },
  { href: "/vault", label: "Konton", icon: "🔑", lock: true, roles: ["owner", "leadership"] },
  { href: "/finance", label: "Kassa", icon: "🏦", lock: true, roles: ["owner", "leadership"] },
  {
    href: "/settings/integrations",
    label: "Inställningar",
    icon: "⚙️",
    lock: true,
    roles: ["owner", "leadership"],
  },
] as const;

export function TopNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(profile.role)
  );

  const roleLabel =
    profile.role === "owner"
      ? "Ägare"
      : profile.role === "leadership"
      ? "Ledning"
      : "Personal";

  return (
    <header className="sticky top-0 z-30 bg-neutral-900 border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
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
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  }`}
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                  {"lock" in item && item.lock && (
                    <span aria-hidden className="text-xs opacity-70">
                      🔒
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-white leading-tight">
                {profile.full_name}
              </p>
              <p className="text-xs text-neutral-500 leading-tight">
                {roleLabel}
              </p>
            </div>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition">
                Logga ut
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
