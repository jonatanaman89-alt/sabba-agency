"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  amount: number;
  currency: string;
  buyer_ref: string | null;
  received_at: string;
  model_id: string | null;
  models: { name: string } | null;
};

export function SalesLive({ initialSales }: { initialSales: Sale[] }) {
  const supabase = createClient();
  const [sales, setSales] = useState<Sale[]>(initialSales);

  useEffect(() => {
    const channel = supabase
      .channel("sales-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sales" },
        (payload) => {
          setSales((prev) => [payload.new as Sale, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const total14d = useMemo(
    () => sales.reduce((s, r) => s + Number(r.amount), 0),
    [sales]
  );

  const byModel = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      const name = s.models?.name || "Okänd";
      map.set(name, (map.get(name) ?? 0) + Number(s.amount));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sales]);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-1">
            Totalt, senaste 14 dagarna
          </p>
          <p className="text-3xl font-semibold text-white">
            {total14d.toLocaleString("sv-SE")} kr
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-2">
            Topp-modeller denna period
          </p>
          <div className="space-y-1">
            {byModel.length === 0 && (
              <p className="text-neutral-500 text-sm">Ingen data ännu.</p>
            )}
            {byModel.map(([name, amount]) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-neutral-300">{name}</span>
                <span className="text-white font-medium">
                  {amount.toLocaleString("sv-SE")} kr
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-white text-sm font-medium mb-3">
        Senaste transaktioner
      </h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800 max-h-[480px] overflow-y-auto">
        {sales.length === 0 && (
          <p className="text-neutral-500 text-sm px-5 py-6">
            Inga försäljningar ännu. Koppla webhooken från er säljsida för att
            se data live här.
          </p>
        )}
        {sales.map((s) => (
          <div key={s.id} className="flex items-center justify-between px-5 py-3">
            <div>
              <p className="text-white text-sm">{s.models?.name || "Okänd modell"}</p>
              <p className="text-neutral-500 text-xs">
                {new Date(s.received_at).toLocaleString("sv-SE")}
              </p>
            </div>
            <p className="text-emerald-400 text-sm font-medium">
              +{Number(s.amount).toLocaleString("sv-SE")} {s.currency}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
