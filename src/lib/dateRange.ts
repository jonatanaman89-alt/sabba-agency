// Delad logik för datumintervall-filtret på Ekonomi och Sales.
// Håller sig i URL:en (?range=...&from=...&to=...) så vyn är länkbar och
// beräkningen sker på servern (SSR) — inget extra klient-JS krävs för
// själva filtreringen.

export type RangeKey = "today" | "7d" | "month" | "last_month" | "custom";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Idag",
  "7d": "Senaste 7 dagarna",
  month: "Denna månad",
  last_month: "Förra månaden",
  custom: "Eget intervall",
};

export const RANGE_ORDER: RangeKey[] = ["today", "7d", "month", "last_month", "custom"];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export type ResolvedRange = {
  key: RangeKey;
  /** Inklusive, YYYY-MM-DD */
  fromDate: string;
  /** Inklusive, YYYY-MM-DD */
  toDate: string;
  /** ISO-tidsstämpel vid dygnets start för `from`, för .gte() mot timestamp-kolumner */
  fromISO: string;
  /** ISO-tidsstämpel precis efter dygnets slut för `to`, för .lt() mot timestamp-kolumner */
  toExclusiveISO: string;
  label: string;
};

/**
 * Tolkar sökparametrar (range, from, to) till ett konkret datumintervall.
 * Standard om inget/ogiltigt anges: denna månad.
 */
export function resolveDateRange(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): ResolvedRange {
  const now = new Date();
  const today = startOfDay(now);

  const rawKey = searchParams.range;
  const key: RangeKey =
    rawKey === "today" ||
    rawKey === "7d" ||
    rawKey === "month" ||
    rawKey === "last_month" ||
    rawKey === "custom"
      ? rawKey
      : "month";

  if (key === "custom" && searchParams.from && searchParams.to) {
    const from = new Date(searchParams.from + "T00:00:00");
    const to = new Date(searchParams.to + "T00:00:00");
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) {
      const toExclusive = new Date(to);
      toExclusive.setDate(toExclusive.getDate() + 1);
      return {
        key,
        fromDate: toISODate(from),
        toDate: toISODate(to),
        fromISO: from.toISOString(),
        toExclusiveISO: toExclusive.toISOString(),
        label: RANGE_LABELS.custom,
      };
    }
    // Ogiltigt eget intervall — falla tillbaka till denna månad.
  }

  let from: Date;
  let toExclusive: Date;

  switch (key) {
    case "today": {
      from = today;
      toExclusive = new Date(today);
      toExclusive.setDate(toExclusive.getDate() + 1);
      break;
    }
    case "7d": {
      from = new Date(today);
      from.setDate(from.getDate() - 6); // inkl. idag = 7 dagar totalt
      toExclusive = new Date(today);
      toExclusive.setDate(toExclusive.getDate() + 1);
      break;
    }
    case "last_month": {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      toExclusive = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    }
    case "month":
    default: {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      toExclusive = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      break;
    }
  }

  const toInclusive = new Date(toExclusive);
  toInclusive.setDate(toInclusive.getDate() - 1);

  return {
    key,
    fromDate: toISODate(from),
    toDate: toISODate(toInclusive),
    fromISO: from.toISOString(),
    toExclusiveISO: toExclusive.toISOString(),
    label: key === "custom" ? RANGE_LABELS.custom : RANGE_LABELS[key],
  };
}
