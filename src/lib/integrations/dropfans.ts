// Klient för Dropfans externa API (https://www.dropfans.io/developers).
// Server-only: kallas från Server Actions och cron-routen, aldrig från klienten.

const BASE_URL = "https://www.dropfans.io";

export type DropfansMeResponse = {
  id: string;
  username: string;
  name: string;
  image: string | null;
  accountType: string;
  key: { name: string; app: string | null; tier: string };
};

export type DropfansTransaction = {
  id: string;
  productId?: string;
  productName?: string;
  amountCents: number; // NET (efter plattformsavgift)
  grossAmountCents: number; // GROSS (vad köparen betalade)
  buyerEmail?: string | null;
  buyerName?: string | null;
  paidAt: string; // ISO 8601
  type: "drop" | "tip" | "subscription";
};

export type DropfansEarningsResponse = {
  stats: {
    totalEarningsCents: number;
    grossEarningsCents: number;
    transactionCount: number;
  };
  chart: {
    labels: string[];
    values: number[];
    dates: string[];
  };
  transactions: DropfansTransaction[];
};

export class DropfansApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "DropfansApiError";
  }
}

/** Verifierar en API-nyckel genom GET /api/external/me. Kastar DropfansApiError vid 401. */
export async function verifyDropfansKey(
  apiKey: string
): Promise<DropfansMeResponse> {
  const res = await fetch(`${BASE_URL}/api/external/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new DropfansApiError(res.status, body || res.statusText);
  }

  return res.json();
}

/**
 * Hämtar intäkter/transaktioner för ett fönster (max 50 nyaste transaktioner,
 * ingen paginering – se Dropfans-dokumentationen). Datum i formatet YYYY-MM-DD.
 */
export async function fetchDropfansEarnings(
  apiKey: string,
  startDate: string,
  endDate: string,
  tz: string
): Promise<DropfansEarningsResponse> {
  const url = new URL(`${BASE_URL}/api/external/earnings`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("tz", tz);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new DropfansApiError(res.status, body || res.statusText);
  }

  return res.json();
}

/** YYYY-MM-DD för N dagar sedan, i UTC (räcker för att bygga query-fönstret). */
export function daysAgoISODate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
