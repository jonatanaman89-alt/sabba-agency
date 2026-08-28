import Link from "next/link";
import { signOut } from "@/app/actions";
import type { Profile } from "@/lib/getProfile";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Hem", roles: ["owner", "leadership", "staff"] },
  { href: "/models", label: "Modeller", roles: ["owner", "leadership", "staff"] },
  { href: "/sales", label: "Sales", roles: ["owner", "leadership"] },
  { href: "/finance", label: "Ekonomi", roles: ["owner", "leadership"] },
  { href: "/vault", label: "Konton 🔒", roles: ["owner", "leadership"] },
  {
    href: "/settings/integrations",
    label: "Integrationer",
    roles: ["owner", "leadership"],
  },
] as const;

export function Sidebar({ profile }: { profile: Profile }) {
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
    <aside className="w-56 shrink-0 bg-neutral-900 border-r border-neutral-800 flex flex-col min-h-screen">
      <div className="px-5 py-5 border-b border-neutral-800">
        <p className="text-white font-semibold tracking-tight">SABBA</p>
        <p className="text-neutral-500 text-xs mt-0.5">Ledningssystem</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-neutral-800">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm text-white truncate">{profile.full_name}</p>
          <p className="text-xs text-neutral-500">{roleLabel}</p>
        </div>
        <form action={signOut}>
          <button className="w-full text-left rounded-lg px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition">
            Logga ut
          </button>
        </form>
      </div>
    </aside>
  );
}
