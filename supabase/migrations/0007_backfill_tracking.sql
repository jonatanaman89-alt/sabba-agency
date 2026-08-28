-- SABBA Ledning – spårning för full historik-backfill från Dropfans.
--
-- backfill-history-routen (src/app/api/cron/backfill-history/route.ts) går
-- bakåt i tiden i fönster tills den hittar historikens början för en modell.
-- Den kan behöva flera anrop (Vercel Hobby har kort timeout per anrop), så vi
-- behöver komma ihåg vilka modeller som redan är helt klara.

alter table public.model_integrations
  add column if not exists backfill_done_at timestamptz;
