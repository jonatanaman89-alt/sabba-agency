"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  amount: number;
  gross_amount: number | null;
  currency: string;
  buyer_ref: string | null;
  received_at: string;
  model_id: string | null;
  models: { name: string } | null;
};

export function SalesLive({
  initialSales,
  fxRate,
  rangeLabel,
}: {
  initialSales: Sale[];
  fxRate: number;
  rangeLabel: string;
}) {
  const supabase = createClient();
  // "sales" initieras från initialSales och uppdateras sedan bara via
  // Supabase Realtime (se effekten nedan). Komponenten keyas med
  // datumintervallet av SalesPage, så vid byte av period gör React en
  // ren remount med nytt initialSales istället för att vi synkroniserar
  // props → state i en effekt (se https://react.dev/learn/you-might-not-need-an-effect).
  const [sales, setSales] = useState<Sale[]>(initialSales);
  // Dropfans egen dashboard visar Gross (vad köparen betalade) som standard
  // — matchar vi det som default blir det direkt jämförbart mot en
  // skärmdump därifrån. Net (efter Dropfans avgift) är det som faktiskt
  // landar som intäkt i Ekonomi, så den går att växla till också.
  const [mode, setMode] = useState<"gross" | "net">("gross");

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

  // Fallback till amount (net) om gross_amount saknas — gäller ev. äldre
  // rader från innan gross_amount-kolumnen fanns, eller manuella poster.
  const pickAmount = useCallback(
    (s: Sale): number => {
      if (mode === "gross") {
        return s.gross_amount != null ? Number(s.gross_amount) : Number(s.amount);
      }
      return Number(s.amount);
    },
    [mode]
  );

  // OBS: summerar bara USD-belopp korrekt om alla rader faktiskt är USD
  // (sant idag, eftersom Dropfans är enda källan). Om fler valutor någonsin
  // blandas in här behöver detta grupperas per valuta istället.
  const totalUsd = useMemo(
    () => sales.reduce((s, r) => s + pickAmount(r), 0),
    [sales, pickAmount]
  );
  const totalSek = totalUsd * fxRate;

  const byModel = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => {
      const name = s.models?.name || "Okänd";
      map.set(name, (map.get(name) ?? 0) + pickAmount(s) * fxRate);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [sales, fxRate, pickAmount]);

  const maxModelAmount = byModel[0]?.[1] ?? 0;

  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/[0.06] p-1">
          <button
            onClick={() => setMode("gross")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "gross"
                ? "bg-indigo-500 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Gross
          </button>
          <button
            onClick={() => setMode("net")}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              mode === "net"
                ? "bg-indigo-500 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Net
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.08] to-transparent p-5">
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />
          <p className="text-neutral-400 text-xs mb-1.5 font-medium uppercase tracking-wide">
            Totalt ({mode === "gross" ? "Gross" : "Net"}) · {rangeLabel.toLowerCase()}
          </p>
          <p className="text-3xl font-semibold text-white tracking-tight">
            {totalSek.toLocaleString("sv-SE", {
              maximumFractionDigits: 0,
            })}{" "}
            <span className="text-lg font-normal opacity-70">kr</span>
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            {totalUsd.toLocaleString("sv-SE", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            USD (kurs {fxRate.toFixed(4)}){" "}
            {mode === "gross"
              ? "— samma vy som Dropfans standardvy"
              : "— jämförbart med Ekonomi-sidans summa för samma period"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-neutral-400 text-xs mb-3 font-medium uppercase tracking-wide">
            Topp-modeller
          </p>
          <div className="space-y-2.5">
            {byModel.length === 0 && (
              <p className="text-neutral-500 text-sm">Ingen data ännu.</p>
            )}
            {byModel.map(([name, amount]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-neutral-300">{name}</span>
                  <span className="text-white font-medium">
                    {amount.toLocaleString("sv-SE", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    kr
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500/70"
                    style={{
                      width: `${
                        maxModelAmount > 0
                          ? (amount / maxModelAmount) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="text-white text-sm font-medium mb-3">
        Senaste transaktioner
      </h2>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.06] max-h-[480px] overflow-y-auto">
        {sales.length === 0 && (
          <p className="text-neutral-500 text-sm px-5 py-6">
            Inga försäljningar under den valda perioden ännu.
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
              {(pickAmount(s) * fxRate).toLocaleString("sv-SE", {
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
