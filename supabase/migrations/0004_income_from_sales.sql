-- SABBA Ledning – koppla Ekonomi (income) automatiskt till Sales (Dropfans-synken)
-- Kör EFTER 0001–0003, i samma SQL Editor.
--
-- Varje ny Dropfans-försäljning som synkas in skapar nu automatiskt en
-- motsvarande intäktspost i Ekonomi, omräknad till SEK. source_sale_id
-- gör kopplingen spårbar och förhindrar dubbelbokning om synken körs
-- flera gånger (unikt index nedan).

alter table public.income add column if not exists source_sale_id uuid references public.sales(id) on delete set null;
alter table public.income add column if not exists fx_rate numeric(12,6);
alter table public.income add column if not exists original_amount numeric(12,2);
alter table public.income add column if not exists original_currency text;

create unique index if not exists income_source_sale_unique
  on public.income(source_sale_id)
  where source_sale_id is not null;
