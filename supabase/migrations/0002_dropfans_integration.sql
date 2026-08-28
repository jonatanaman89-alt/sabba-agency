-- SABBA Ledning – Dropfans-integration
-- Kör EFTER 0001_init.sql, i samma SQL Editor.

-- =========================================================
-- 1. INTEGRATIONER PER MODELL (Dropfans API-nyckel)
-- =========================================================
-- Varje modell har sitt eget Dropfans-konto och därmed sin egen dpfn_-nyckel.
-- Nyckeln krypteras med en servernyckel (INTEGRATION_ENCRYPTION_KEY) som bara
-- finns i miljövariablerna – aldrig i databasen i klartext, och aldrig synlig
-- för klienten. Detta är en annan lagringsmodell än lösenordsvalvet (som kräver
-- en mänsklig huvudnyckel varje gång): den här behöver kunna dekrypteras
-- automatiskt av synk-jobbet utan att någon är inloggad.
create table public.model_integrations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models(id) on delete cascade,
  provider text not null default 'dropfans',
  encrypted_api_key text not null,
  iv text not null,
  timezone text not null default 'Europe/Stockholm',
  last_synced_at timestamptz,
  last_sync_status text, -- 'ok' | 'error'
  last_sync_error text,
  created_at timestamptz not null default now(),
  unique (model_id, provider)
);

alter table public.model_integrations enable row level security;

create policy "integrations_leadership_only"
  on public.model_integrations for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- =========================================================
-- 2. SALES: STÖD FÖR DEDUPLICERING FRÅN DROPFANS
-- =========================================================
-- external_id = Dropfans transaktions-id (t.ex. "clx0rd3r000001sale").
-- Unikt index gör att samma köp aldrig sparas två gånger även om
-- synk-jobbet råkar hämta samma period flera gånger.
alter table public.sales add column if not exists external_id text;
alter table public.sales add column if not exists source_provider text not null default 'manual';
alter table public.sales add column if not exists gross_amount numeric(12,2);
alter table public.sales add column if not exists sale_type text; -- 'drop' | 'tip' | 'subscription'

create unique index if not exists sales_external_id_unique
  on public.sales(source_provider, external_id)
  where external_id is not null;
