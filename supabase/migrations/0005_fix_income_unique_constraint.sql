-- SABBA Ledning – fix för Ekonomi-kopplingen (samma typ av bugg som 0003,
-- fast på income-tabellen den här gången). Kör efter 0001–0004.
--
-- Ett partiellt unikt index ("where source_sale_id is not null") funkar inte
-- som mål för .upsert(onConflict: ...) om man inte också anger samma WHERE i
-- ON CONFLICT-satsen, vilket Supabase inte gör automatiskt. Ett vanligt
-- UNIQUE constraint funkar precis lika bra: NULL räknas aldrig som lika med
-- ett annat NULL i Postgres, så manuella intäktsposter (source_sale_id = NULL)
-- krockar aldrig med varandra.

drop index if exists public.income_source_sale_unique;

alter table public.income
  add constraint income_source_sale_unique unique (source_sale_id);
