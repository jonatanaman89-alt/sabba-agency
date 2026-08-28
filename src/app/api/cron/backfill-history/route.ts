import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptApiKey } from "@/lib/integrations/serverCrypto";
import { fetchDropfansEarnings, DropfansApiError } from "@/lib/integrations/dropfans";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";

// Engångsverktyg: hämtar ALL historisk försäljning från Dropfans, inte bara
// de senaste dagarna som den vanliga sync-dropfans-crawlern gör. Dropfans
// earnings-endpointen ger max 50 nyaste transaktioner PER FÖNSTER (ingen
// paginering), så vi går bakåt i tiden i korta fönster (7 dagar i taget) tills
// vi hittar två tomma fönster i rad — det räknas som "klart" för den modellen.
//
// Körs säkert flera gånger: samma unika index som sync-dropfans (migration
// 0003/0005) förhindrar dubbletter både i sales och income.
//
// Vercel Hobby ger bara ~10s per anrop, så detta bearbetar EN modell och ett
// begränsat antal fönster per anrop, och svarar med done:false + var man ska
// fortsätta (cursor) om det finns mer kvar — anropa igen med samma
// modelId+cursor tills done:true. Utan modelId startar den om från början
// (första okopplade/ej-klarmarkerade modellen).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 7;
const MAX_WINDOWS_PER_CALL = 8; // ~8 * (1 fetch + ev upserts), håller sig under 10s
const EMPTY_WINDOWS_TO_STOP = 2; // två tomma fönster i rad = vi har nått början

function isoDateMinus(days: number, from: Date): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const providedSecret =
    req.headers.get("x-cron-secret") ||
    req.nextUrl.searchParams.get("secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const usdToSek = await fetchUsdToSekRate();

  const requestedModelId = req.nextUrl.searchParams.get("modelId");
  // Hur många dagar bakåt från idag cursorn redan kommit (0 = börja om från idag).
  const cursorDaysBack = Number(req.nextUrl.searchParams.get("cursorDaysBack") || "0");

  const { data: integrations, error: fetchError } = await supabase
    .from("model_integrations")
    .select("id, model_id, encrypted_api_key, iv, timezone, backfill_done_at")
    .eq("provider", "dropfans");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const target = requestedModelId
    ? (integrations ?? []).find((i) => i.model_id === requestedModelId)
    : (integrations ?? []).find((i) => !i.backfill_done_at);

  if (!target) {
    return NextResponse.json({
      done: true,
      message: requestedModelId
        ? "Hittade ingen integration för det model_id:t."
        : "Alla kopplade modeller är redan fullständigt backfyllda.",
    });
  }

  try {
    const apiKey = decryptApiKey(target.encrypted_api_key, target.iv);
    const tz = target.timezone || "Europe/Stockholm";
    const now = new Date();

    let daysBack = cursorDaysBack;
    let emptyStreak = 0;
    let windowsChecked = 0;
    let totalNewSales = 0;
    let totalNewIncome = 0;
    let reachedStart = false;

    while (windowsChecked < MAX_WINDOWS_PER_CALL) {
      const endDate = isoDateMinus(daysBack, now);
      const startDate = isoDateMinus(daysBack + WINDOW_DAYS - 1, now);

      const earnings = await fetchDropfansEarnings(apiKey, startDate, endDate, tz);
      windowsChecked++;

      if (earnings.transactions.length === 0) {
        emptyStreak++;
        if (emptyStreak >= EMPTY_WINDOWS_TO_STOP) {
          reachedStart = true;
          break;
        }
      } else {
        emptyStreak = 0;

        const rows = earnings.transactions.map((tx) => ({
          model_id: target.model_id,
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

        const { data: upserted, error: upsertError } = await supabase
          .from("sales")
          .upsert(rows, {
            onConflict: "source_provider,external_id",
            ignoreDuplicates: true,
          })
          .select("id, model_id, amount, sale_type, received_at");

        if (upsertError) throw upsertError;
        totalNewSales += upserted?.length ?? 0;

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
            description: `Dropfans ${sale.sale_type} (historik-backfill, ${sale.amount} USD × ${usdToSek.toFixed(4)})`,
          }));

          const { data: insertedIncome, error: incomeError } = await supabase
            .from("income")
            .upsert(incomeRows, { onConflict: "source_sale_id", ignoreDuplicates: true })
            .select("id");

          if (incomeError) throw incomeError;
          totalNewIncome += insertedIncome?.length ?? 0;
        }
      }

      daysBack += WINDOW_DAYS;
    }

    if (reachedStart) {
      await supabase
        .from("model_integrations")
        .update({ backfill_done_at: new Date().toISOString() })
        .eq("id", target.id);

      return NextResponse.json({
        done: true,
        modelId: target.model_id,
        message: `Klar — nådde start på historiken (${EMPTY_WINDOWS_TO_STOP} tomma fönster i rad).`,
        newSales: totalNewSales,
        newIncomePosts: totalNewIncome,
        daysSearched: daysBack,
      });
    }

    return NextResponse.json({
      done: false,
      modelId: target.model_id,
      message: "Fler fönster kvar — anropa igen med samma modelId och cursorDaysBack.",
      cursorDaysBack: daysBack,
      newSales: totalNewSales,
      newIncomePosts: totalNewIncome,
    });
  } catch (e) {
    const message =
      e instanceof DropfansApiError
        ? `Dropfans ${e.status}: ${e.message}`
        : e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
        ? `${(e as { message: string }).message}${
            "code" in e ? ` (code: ${(e as { code: string }).code})` : ""
          }`
        : `Okänt fel (${JSON.stringify(e).slice(0, 300)})`;

    return NextResponse.json(
      { done: false, modelId: target.model_id, error: message },
      { status: 500 }
    );
  }
}
