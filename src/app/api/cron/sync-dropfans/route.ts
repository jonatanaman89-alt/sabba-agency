import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/integrations/serverCrypto";
import {
  fetchDropfansEarnings,
  daysAgoISODate,
  DropfansApiError,
} from "@/lib/integrations/dropfans";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";

// Node.js-runtime krävs för node:crypto i serverCrypto.ts.
export const runtime = "nodejs";
// Kör aldrig cachad — varje anrop ska hämta färsk data.
export const dynamic = "force-dynamic";

// Hur långt tillbaka vi hämtar varje gång. Dropfans earnings-endpointen
// returnerar bara de 50 senaste transaktionerna totalt (ingen paginering),
// så ett kort fönster + tätt schema är bättre än ett brett fönster mer sällan.
const SYNC_WINDOW_DAYS = 3;

export async function GET(req: NextRequest) {
  const providedSecret =
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // En kursförfrågan per körning räcker gott — sparas på varje intäktspost
  // så det alltid går att se exakt vilken kurs som användes.
  const usdToSek = await fetchUsdToSekRate();

  const { data: integrations, error: fetchError } = await supabase
    .from("model_integrations")
    .select("id, model_id, encrypted_api_key, iv, timezone")
    .eq("provider", "dropfans");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const startDate = daysAgoISODate(SYNC_WINDOW_DAYS);
  const endDate = daysAgoISODate(0);

  const results: Array<{
    modelId: string;
    ok: boolean;
    newSales?: number;
    newIncomePosts?: number;
    error?: string;
  }> = [];

  for (const integration of integrations ?? []) {
    try {
      const apiKey = decryptApiKey(
        integration.encrypted_api_key,
        integration.iv
      );

      const earnings = await fetchDropfansEarnings(
        apiKey,
        startDate,
        endDate,
        integration.timezone || "Europe/Stockholm"
      );

      const rows = earnings.transactions.map((tx) => ({
        model_id: integration.model_id,
        amount: tx.amountCents / 100,
        gross_amount: tx.grossAmountCents / 100,
        currency: "USD",
        source_provider: "dropfans",
        external_id: tx.id,
        sale_type: tx.type,
        buyer_ref: tx.buyerEmail ?? null,
        received_at: tx.paidAt,
        raw_payload: tx,
      }));

      let newSales = 0;
      let newIncomePosts = 0;

      if (rows.length > 0) {
        const { data: upserted, error: upsertError } = await supabase
          .from("sales")
          .upsert(rows, {
            onConflict: "source_provider,external_id",
            ignoreDuplicates: true,
          })
          .select("id, model_id, amount, sale_type, received_at");

        if (upsertError) throw upsertError;
        newSales = upserted?.length ?? 0;

        // Skapa automatiskt en Ekonomi-intäktspost per NY försäljning (upserted
        // innehåller bara rader som faktiskt var nya, tack vare ignoreDuplicates).
        // source_sale_id + unikt index (migration 0004) gör detta säkert att
        // köra flera gånger utan att dubbelboka.
        if (upserted && upserted.length > 0) {
          const incomeRows = upserted.map((sale) => ({
            model_id: sale.model_id,
            amount: Math.round(sale.amount * usdToSek * 100) / 100,
            currency: "SEK",
            source: "webhook",
            source_sale_id: sale.id,
            original_amount: sale.amount,
            original_currency: "USD",
            fx_rate: usdToSek,
            occurred_at: sale.received_at.slice(0, 10),
            description: `Dropfans ${sale.sale_type} (auto, ${sale.amount} USD × ${usdToSek.toFixed(
              4
            )})`,
          }));

          const { data: insertedIncome, error: incomeError } = await supabase
            .from("income")
            .upsert(incomeRows, {
              onConflict: "source_sale_id",
              ignoreDuplicates: true,
            })
            .select("id");

          if (incomeError) throw incomeError;
          newIncomePosts = insertedIncome?.length ?? 0;
        }
      }

      await supabase
        .from("model_integrations")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "ok",
          last_sync_error: null,
        })
        .eq("id", integration.id);

      results.push({
        modelId: integration.model_id,
        ok: true,
        newSales,
        newIncomePosts,
      });
    } catch (e) {
      // Logga hela felet i terminalen där `npm run dev` körs, så vi kan
      // felsöka även när felobjektet inte är en vanlig Error-instans
      // (t.ex. Supabase PostgrestError, som är ett vanligt objekt).
      console.error("[sync-dropfans] fel för modell", integration.model_id, e);

      const message =
        e instanceof DropfansApiError
          ? `Dropfans ${e.status}: ${e.message}`
          : e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
          ? `${(e as { message: string }).message}${
              "code" in e ? ` (code: ${(e as { code: string }).code})` : ""
            }${
              "hint" in e && (e as { hint?: string }).hint
                ? ` — hint: ${(e as { hint: string }).hint}`
                : ""
            }`
          : `Okänt fel (${JSON.stringify(e).slice(0, 300)})`;

      await supabase
        .from("model_integrations")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "error",
          last_sync_error: message.slice(0, 500),
        })
        .eq("id", integration.id);

      results.push({ modelId: integration.model_id, ok: false, error: message });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
