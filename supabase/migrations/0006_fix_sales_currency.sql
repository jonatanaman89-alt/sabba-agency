-- SABBA Ledning – engångsfix för felmärkta valutor på gamla sales-rader.
--
-- sales.currency har "default 'SEK'" i schemat (migration 0001). Rader som
-- synkades från Dropfans innan cron-jobbet uttryckligen satte currency='USD'
-- fastnade därför på SEK trots att amount faktiskt är i USD. Dropfans är just
-- nu enda källan för source_provider='dropfans', och all data därifrån är
-- alltid USD (se dropfans.ts), så det är säkert att rätta samtliga sådana rader.

update public.sales
set currency = 'USD'
where source_provider = 'dropfans'
  and currency <> 'USD';
