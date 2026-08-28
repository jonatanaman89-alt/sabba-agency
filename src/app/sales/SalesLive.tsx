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

export function SalesLive({
  initialSales,
  fxRate,
}: {
  initialSales: Sale[];
  fxRate: number;
}) {
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

  // OBS: summerar bara USD-belopp korrekt om alla rader faktiskt är USD
  // (sant idag, eftersom Dropfans är enda källan). Om fler valutor någonsin
  // blandas in här behöver detta grupperas per valuta istället.
  const totalUsd = useMemo(
    () => sales.reduce((s, r) => s + Number(r.amount), 0),
    [sales]
  );
  const totalSek = totalUsd * fxRate;

  const byModel = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      const name = s.models?.name || "Okänd";
      map.set(name, (map.get(name) ?? 0) + Number(s.amount) * fxRate);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sales, fxRate]);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-1">Totalt, denna månad</p>
          <p className="text-3xl font-semibold text-white">
            {totalSek.toLocaleString("sv-SE", {
              maximumFractionDigits: 0,
            })}{" "}
            kr
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            {totalUsd.toLocaleString("sv-SE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USD (kurs {fxRate.toFixed(4)}) — jämförbart med Ekonomi-sidans
            summa för samma månad
          </p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
          <p className="text-neutral-400 text-xs mb-2">
            Topp-modeller denna månad
          </p>
          <div className="space-y-1">
            {byModel.length === 0 && (
              <p className="text-neutral-500 text-sm">Ingen data ännu.</p>
            )}
            {byModel.map(([name, amount]) => (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-neutral-300">{name}</span>
                <span className="text-white font-medium">
                  {amount.toLocaleString("sv-SE", {
                    maximumFractionDigits: 0,
                  })}{" "}
                  kr
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
            Inga försäljningar den här månaden ännu.
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
              +
              {(Number(s.amount) * fxRate).toLocaleString("sv-SE", {
                maximumFractionDigits: 0,
              })}{" "}
              kr
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
