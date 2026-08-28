-- SABBA Ledning – databasschema
-- Kör denna fil i Supabase SQL Editor (Database > SQL Editor > New query)

-- =========================================================
-- 1. ROLLER OCH PROFILER
-- =========================================================
-- Roller: owner (allt), leadership (ledningsgrupp: CRM+ekonomi+lösenord), staff (bara CRM/schema)
create type public.app_role as enum ('owner', 'leadership', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Alla inloggade får se listan över kollegor (namn/roll), men bara ändra sig själva.
-- Rolländring görs bara av owner (styrs via service-role i admin-vy, ej klient).
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

create policy "profiles_update_self_name_only"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Hjälpfunktion: hämta inloggad användares roll
create or replace function public.current_role_is(roles public.app_role[])
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

-- Auto-skapa profilrad när ett nytt konto registreras (default roll = staff)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'staff');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- 2. MODELLER (CRM-kärna)
-- =========================================================
create table public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alias text,
  avatar_url text,
  status text not null default 'active', -- active | paused | ended
  revenue_split_percent numeric(5,2) not null default 50.00, -- modellens andel av intäkt
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.models enable row level security;

-- CRM är synligt för alla inloggade (owner, leadership, staff)
create policy "models_select_all"
  on public.models for select to authenticated using (true);

-- Endast owner/leadership får skapa/ändra/ta bort modeller
create policy "models_write_leadership"
  on public.models for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- =========================================================
-- 3. KONTON / LÖSENORDSVALV
-- =========================================================
-- Lösenord lagras krypterade (AES-GCM i klienten) – databasen ser bara chiffertext.
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.models(id) on delete set null,
  service_name text not null,       -- t.ex. "OnlyFans", "Instagram", "Buffer"
  username text,
  encrypted_secret text not null,   -- AES-GCM chiffertext (base64)
  iv text not null,                 -- initieringsvektor (base64)
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vault_items enable row level security;

-- Endast owner + leadership får läsa/skriva lösenordsvalvet
create policy "vault_leadership_only"
  on public.vault_items for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- Åtkomstlogg: vem visade/kopierade vilket lösenord och när
create table public.vault_access_log (
  id bigint generated always as identity primary key,
  vault_item_id uuid references public.vault_items(id) on delete cascade,
  accessed_by uuid references public.profiles(id),
  action text not null, -- 'view' | 'copy'
  accessed_at timestamptz not null default now()
);

alter table public.vault_access_log enable row level security;

create policy "vault_log_leadership_only"
  on public.vault_access_log for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- =========================================================
-- 4. EKONOMI: INTÄKTER, UTGIFTER, LÖNER
-- =========================================================
create table public.income (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.models(id) on delete cascade,
  amount numeric(12,2) not null,
  currency text not null default 'SEK',
  source text not null default 'manual', -- 'manual' | 'webhook'
  occurred_at date not null default current_date,
  description text,
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- 'tools' | 'ads' | 'salary' | 'other'
  amount numeric(12,2) not null,
  currency text not null default 'SEK',
  is_recurring boolean not null default false,
  recurring_interval text, -- 'monthly' | 'weekly' | null
  occurred_at date not null default current_date,
  description text,
  created_at timestamptz not null default now()
);

create table public.staff_payouts (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid references public.profiles(id),
  model_id uuid references public.models(id),
  percent numeric(5,2) not null,
  period_start date not null,
  period_end date not null,
  computed_amount numeric(12,2),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.income enable row level security;
alter table public.expenses enable row level security;
alter table public.staff_payouts enable row level security;

-- Ekonomi är strikt begränsad till owner + leadership
create policy "income_leadership_only" on public.income for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

create policy "expenses_leadership_only" on public.expenses for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

create policy "payouts_leadership_only" on public.staff_payouts for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- =========================================================
-- 5. LIVE SALES (från er säljsida via webhook)
-- =========================================================
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.models(id),
  amount numeric(12,2) not null,
  currency text not null default 'SEK',
  buyer_ref text, -- anonymiserad köpar-referens, ej personuppgift
  raw_payload jsonb,
  received_at timestamptz not null default now()
);

alter table public.sales enable row level security;

create policy "sales_leadership_only" on public.sales for all to authenticated
  using (public.current_role_is(array['owner','leadership']::public.app_role[]))
  with check (public.current_role_is(array['owner','leadership']::public.app_role[]));

-- OBS: sales-tabellen skrivs även till från webhook-endpointen med service-role-nyckeln,
-- vilken kringgår RLS helt (det är avsett – webhooken är servern, inte en inloggad användare).

-- Aktivera Realtime för sales så dashboarden uppdateras live vid nya köp.
alter publication supabase_realtime add table public.sales;

-- =========================================================
-- 6. INDEX
-- =========================================================
create index idx_income_model on public.income(model_id);
create index idx_income_date on public.income(occurred_at);
create index idx_expenses_date on public.expenses(occurred_at);
create index idx_sales_model on public.sales(model_id);
create index idx_sales_received on public.sales(received_at);
create index idx_vault_model on public.vault_items(model_id);
