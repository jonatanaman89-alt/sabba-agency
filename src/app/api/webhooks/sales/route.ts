import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint som er säljsida (Shopify, egen kod, etc.) POSTar till vid varje köp.
//
// URL när deployat: https://din-app.vercel.app/api/webhooks/sales
//
// Header:  X-Webhook-Secret: <SALES_WEBHOOK_SECRET från .env>
// Body (JSON):
// {
//   "model_name": "Namnet exakt som i systemet, eller model_id",
//   "amount": 499.00,
//   "currency": "SEK",           // valfritt, default SEK
//   "buyer_ref": "kund_123",     // valfritt, ANVÄND EJ personuppgifter
//   "raw": { ... valfri extra data ... }
// }

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.SALES_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { model_name, model_id, amount, currency, buyer_ref, raw } = body;

  if (!amount || (!model_name && !model_id)) {
    return NextResponse.json(
      { error: "amount och model_name/model_id krävs" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  let resolvedModelId = model_id ?? null;
  if (!resolvedModelId && model_name) {
    const { data: model } = await supabase
      .from("models")
      .select("id")
      .ilike("name", model_name)
      .maybeSingle();
    resolvedModelId = model?.id ?? null;
  }

  const { error } = await supabase.from("sales").insert({
    model_id: resolvedModelId,
    amount,
    currency: currency ?? "SEK",
    buyer_ref: buyer_ref ?? null,
    raw_payload: raw ?? body,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
