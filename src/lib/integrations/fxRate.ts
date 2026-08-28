// Hämtar dagens USD → SEK-kurs från Frankfurter (gratis, ingen nyckel krävs,
// baserat på Europeiska centralbankens referenskurser). Fallback till en
// fast kurs om anropet skulle misslyckas, så synken aldrig stoppas av detta.

const FALLBACK_USD_TO_SEK = 10.0;

export async function fetchUsdToSekRate(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?from=USD&to=SEK",
      { cache: "no-store" }
    );
    if (!res.ok) return FALLBACK_USD_TO_SEK;

    const data = (await res.json()) as { rates?: { SEK?: number } };
    const rate = data.rates?.SEK;

    return typeof rate === "number" && rate > 0 ? rate : FALLBACK_USD_TO_SEK;
  } catch {
    return FALLBACK_USD_TO_SEK;
  }
}
