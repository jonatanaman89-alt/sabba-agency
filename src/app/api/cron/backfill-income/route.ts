import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchUsdToSekRate } from "@/lib/integrations/fxRate";

// Engångsåtgärd: skapar Ekonomi-intäktsposter (income) för Dropfans-sales-rader
// som redan fanns i databasen INNAN synken kopplades ihop med Ekonomi
// (dvs. sales utan en matchande income.source_sale_id än). Säker att köra
// flera gånger — samma unika index (migration 0004) förhindrar dubbletter.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Alla Dropfans-sales som saknar en kopplad income-rad.
  const { data: existingIncome, error: incomeFetchError } = await supabase
    .from("income")
    .select("source_sale_id")
    .not("source_sale_id", "is", null);

  if (incomeFetchError) {
    return NextResponse.json({ error: incomeFetchError.message }, { status: 500 });
  }

  const alreadyLinked = new Set(
    (existingIncome ?? []).map((r) => r.source_sale_id as string)
  );

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, model_id, amount, sale_type, received_at")
    .eq("source_provider", "dropfans");

  if (salesError) {
    return NextResponse.json({ error: salesError.message }, { status: 500 });
  }

  const missing = (sales ?? []).filter((s) => !alreadyLinked.has(s.id));

  if (missing.length === 0) {
    return NextResponse.json({ backfilled: 0, message: "Inget att göra — allt redan kopplat." });
  }

  const incomeRows = missing.map((sale) => ({
    model_id: sale.model_id,
    amount: Math.round(sale.amount * usdToSek * 100) / 100,
    currency: "SEK",
    source: "webhook",
    source_sale_id: sale.id,
    original_amount: sale.amount,
    original_currency: "USD",
    fx_rate: usdToSek,
    occurred_at: sale.received_at.slice(0, 10),
    description: `Dropfans ${sale.sale_type} (backfill, ${sale.amount} USD × ${usdToSek.toFixed(4)})`,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("income")
    .upsert(incomeRows, {
      onConflict: "source_sale_id",
      ignoreDuplicates: true,
    })
    .select("id");

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    backfilled: inserted?.length ?? 0,
    candidatesChecked: missing.length,
    fxRateUsed: usdToSek,
  });
}
