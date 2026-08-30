import type { ComponentProps } from "react";
import { requireProfileWithClient, canSeeFinanceAndVault } from "@/lib/getProfile";
import { AppShell } from "@/components/AppShell";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { redirect } from "next/navigation";
import { SalesLive } from "./SalesLive";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";
import { resolveDateRange } from "@/lib/dateRange";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { profile, supabase } = await requireProfileWithClient();
  if (!canSeeFinanceAndVault(profile.role)) redirect("/dashboard");

  const params = await searchParams;
  const range = resolveDateRange(params);

  // Listan begränsas till 500 rader (samma resonemang som Finance-sidan —
  // ett brett eget datumintervall kan nu efter historik-backfillen ge
  // betydligt fler rader än så). Totalsummorna beräknas ändå korrekt via
  // en separat, obegränsad query (bara amount/gross_amount-kolumnerna,
  // lätt att hämta), så "Totalt"-kortet aldrig tyst blir fel för breda
  // intervall — bara transaktionslistan är avkortad.
  const LIST_LIMIT = 500;

  const [{ data: sales }, { data: allAmounts }, fxRate] = await Promise.all([
    supabase
      .from("sales")
      .select("id, amount, gross_amount, currency, buyer_ref, received_at, model_id, models(name)")
      .gte("received_at", range.fromISO)
      .lt("received_at", range.toExclusiveISO)
      .order("received_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("sales")
      .select("amount, gross_amount, model_id, models(name)")
      .gte("received_at", range.fromISO)
      .lt("received_at", range.toExclusiveISO),
    fetchUsdToSekRate(),
  ]);

  const listIsTruncated = (sales?.length ?? 0) >= LIST_LIMIT;

  return (
    <AppShell profile={profile}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Sales</h1>
        <DateRangeFilter activeKey={range.key} />
      </div>
      <p className="text-neutral-400 text-sm mb-6 max-w-2xl">
        Hämtas automatiskt från varje modells Dropfans-konto (drops, tips och
        prenumerationer). Dropfans har ännu inte riktiga webhooks, så datan
        synkas med jämna mellanrum istället för millisekund för millisekund —
        koppla konton under{" "}
        <a href="/settings/integrations" className="text-indigo-400 hover:text-indigo-300">
          Integrationer
        </a>
        . Visar Gross (vad köparen betalade — samma som Dropfans standardvy)
        med möjlighet att växla till Net (efter Dropfans avgift, det som
        faktiskt landar i Ekonomi). Beloppen är omräknade till SEK (Dropfans
        egen valuta är USD).
      </p>
      {listIsTruncated && (
        <p className="text-amber-400/80 text-xs mb-4">
          Visar de {LIST_LIMIT} senaste transaktionerna för perioden — Totalt-
          och Topp-modeller-korten räknar dock alltid med samtliga. Välj ett
          smalare datumintervall för att se hela listan.
        </p>
      )}
      <SalesLive
        key={`${range.fromDate}_${range.toDate}`}
        initialSales={(sales ?? []) as unknown as ComponentProps<typeof SalesLive>["initialSales"]}
        allAmounts={(allAmounts ?? []) as unknown as ComponentProps<typeof SalesLive>["allAmounts"]}
        fxRate={fxRate}
        rangeLabel={range.label}
      />
    </AppShell>
  );
}
