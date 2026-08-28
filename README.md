# SABBA — Ledningssystem

Internt CRM, ekonomi och lösenordsvalv för ledningsgruppen. Byggt med
Next.js + Supabase (Postgres, inloggning, radnivåbehörighet).

## Vad ingår

- **Inloggning** med e-post/lösenord (Supabase Auth). Ingen kan skapa konto själv — admin lägger till användare.
- **Roller**: `owner`, `leadership`, `staff`. Ekonomi, Sales och lösenordsvalvet är helt dolda för `staff` — både i gränssnittet och i databasen (Row Level Security), så det går inte att komma åt via API-tricks heller.
- **Modeller (CRM)**: namn, alias, status, revenue split. Synligt för alla, redigerbart av ledning.
- **Lösenordsvalv**: krypteras i webbläsaren (AES-GCM) med en huvudnyckel som *aldrig* skickas till servern. Databasen ser bara chiffertext. Loggar vem som visat/kopierat vad och när.
- **Ekonomi**: intäkter, utgifter (engångs/återkommande), marginal per månad. Manuellt inmatad bokföring, separat från Sales-flödet nedan.
- **Sales**: hämtas automatiskt från varje modells eget Dropfans-konto (drops, tips, prenumerationer) via Dropfans officiella API. Dashboarden uppdateras direkt i webbläsaren så fort en ny rad landar i databasen (Supabase Realtime) — men *hur ofta* ny data hämtas från Dropfans styrs av synk-schemat, se avsnitt 7.

## Kom igång (ca 20–30 minuter)

### 1. Skapa Supabase-projekt

1. Gå till [supabase.com](https://supabase.com) → skapa konto → **New project**.
2. Välj namn, lösenord för databasen (spara det säkert) och region (Frankfurt/EU rekommenderas).
3. När projektet är klart: gå till **SQL Editor** → **New query**.
4. Öppna `supabase/migrations/0001_init.sql` i det här projektet, kopiera *hela* innehållet, klistra in och tryck **Run**.
   - Detta skapar alla tabeller, roller och säkerhetsregler i ett svep.
5. Gör om samma sak med `supabase/migrations/0002_dropfans_integration.sql` (i en ny query, **efter** 0001). Den lägger till tabellen som håller Dropfans-kopplingarna per modell.

### 2. Skapa era användare

1. I Supabase: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Ange e-post + tillfälligt lösenord för varje person i ledningsgruppen. Be dem byta lösenord vid första inloggning (kan läggas till senare, eller byt manuellt åt dem nu).
3. Gå till **Table Editor** → tabellen `profiles`. En rad skapas automatiskt per användare (roll = `staff` som standard).
4. Ändra `role`-kolumnen till `owner` eller `leadership` för rätt personer.

### 3. Koppla appen till Supabase

1. I Supabase: **Project Settings** → **API**.
2. Kopiera **Project URL** och **anon public key** samt **service_role key** (håll den hemlig).
3. Skapa filen `.env.local` i projektroten (kopiera `.env.local.example`) och fyll i värdena.
4. Generera tre slumpade hemligheter och lägg in dem i `.env.local`:
   ```bash
   openssl rand -hex 32   # → INTEGRATION_ENCRYPTION_KEY (måste vara exakt 64 tecken)
   openssl rand -hex 32   # → CRON_SECRET
   openssl rand -hex 32   # → SALES_WEBHOOK_SECRET (bara om ni använder den generiska webhooken, se avsnitt 8)
   ```

### 4. Testa lokalt (valfritt)

```bash
npm install
npm run dev
```

Öppna http://localhost:3000 och logga in med en av användarna du skapade.

### 5. Deploya till Vercel (gratis)

1. Skapa konto på [vercel.com](https://vercel.com), koppla ditt GitHub-konto.
2. Pusha detta projekt till ett nytt GitHub-repo.
3. I Vercel: **Add New Project** → välj repot → under **Environment Variables**, lägg in samma variabler som i `.env.local` (alla sex).
4. Klicka **Deploy**. Efter någon minut får ni en URL, t.ex. `sabba-ledning.vercel.app`.
5. (Valfritt) Koppla en egen domän under **Project Settings → Domains**.

### 6. Koppla varje modells Dropfans-konto

Er säljplattform är [Dropfans](https://dropfans.io) (ägs av samma bolag som Kviqa, KVIQVIEW AB). Dropfans har ett eget API där varje creator/modell genererar en egen nyckel:

1. Modellen (eller ni, om ni har tillgång till kontot) loggar in på Dropfans → **Vault → API Connect** → **Generate new key** → välj **Personal**.
2. Kopiera nyckeln (börjar med `dpfn_`) — den visas bara en gång i klartext på Dropfans sida, men går att se igen där vid behov.
3. I SABBA-appen: gå till **Integrationer** i menyn → hitta modellen → **+ Koppla Dropfans** → klistra in nyckeln → **Spara**.
   - Appen verifierar nyckeln direkt mot Dropfans innan den sparas, och bekräftar vilket konto den kopplade.
4. Upprepa för varje modell.

Nyckeln krypteras (AES-256-GCM) med `INTEGRATION_ENCRYPTION_KEY` innan den sparas i databasen, och visas aldrig igen i gränssnittet efter att den sparats — bara ett "Kopplat"-läge.

### 7. Ställ in synk-schemat

Cron-routen `/api/cron/sync-dropfans` hämtar nya transaktioner för alla kopplade modeller och skriver in dem i `sales`-tabellen (dedupliceras automatiskt, så det är ofarligt om den körs flera gånger).

**Vercels inbyggda cron** är redan konfigurerad i `vercel.json` och körs automatiskt efter deploy (ingen extra knapp att trycka på) — men på **gratisplanen (Hobby) tillåter Vercel bara en körning per dygn**, med upp till en timmes fördröjning. Det ger er en daglig katch-all-synk, men ingen verkligt "live" dashboard.

För en dashboard som uppdateras var 5:e minut (rekommenderas), välj ett av:

- **Gratis:** skapa ett konto på [cron-job.org](https://cron-job.org) och lägg till en cron job som anropar:
  ```
  GET https://er-app.vercel.app/api/cron/sync-dropfans
  Header: Authorization: Bearer <samma värde som CRON_SECRET>
  ```
  var 5:e minut. Kostar inget, kräver ingen kod.
- **Vercel Pro (från $20/mån):** tillåter cron ner till varje minut inbyggt — ändra då bara schemat i `vercel.json` (t.ex. `*/5 * * * *`) och redeploya.

Oavsett vilket: så fort en ny rad landar i databasen visas den direkt på Sales-sidan hos alla som har den öppen, tack vare Supabase Realtime — det är själva *hämtningen* från Dropfans som är begränsad av cron-intervallet, inte visningen.

### 8. (Valfritt) Generisk webhook för andra verktyg

Utöver Dropfans-integrationen finns en generell webhook-endpoint kvar (`/api/webhooks/sales`) för om ni i framtiden kopplar in ytterligare ett system som själv kan skicka webhooks vid köp:

```
POST https://er-app.vercel.app/api/webhooks/sales
Header: X-Webhook-Secret: <samma värde som SALES_WEBHOOK_SECRET>
Content-Type: application/json

{
  "model_name": "Namnet exakt som i systemet",
  "amount": 499.00,
  "currency": "SEK",
  "buyer_ref": "anonymiserad-referens"
}
```

## Säkerhetsmodell i korthet

- **RLS (Row Level Security)** i Postgres — även om någon skulle komma åt databasens API-nycklar direkt kan `staff`-roller ändå inte läsa ekonomi, lösenord eller Dropfans-nycklar, eftersom reglerna sitter i databasen, inte bara i gränssnittet.
- **Lösenordsvalvet** krypteras klient-side. Huvudnyckeln delas manuellt inom ledningsgruppen (muntligt, eller via en separat säker kanal — aldrig i Slack/mejl i klartext). Byts huvudnyckeln måste alla poster sparas om.
- **Dropfans-nycklarna** krypteras server-side med `INTEGRATION_ENCRYPTION_KEY` (annan modell än valvet, eftersom synk-jobbet måste kunna dekryptera dem automatiskt utan att någon är inloggad). Visas aldrig igen i gränssnittet.
- **CRON_SECRET** stoppar utomstående från att trigga synken eller läsa av att den körs.
- **Webhook-hemligheten** (`SALES_WEBHOOK_SECRET`) stoppar utomstående från att skicka in falska försäljningsposter via den generiska endpointen.
- **service_role-nyckeln** används bara på servern (cron-jobbet och webhook-endpointen), aldrig i webbläsaren.

## Bra att veta om Dropfans-datan

- Belopp från Dropfans kommer i **USD** (Dropfans egen valuta), medan Ekonomi-modulens manuella inmatning är i **SEK**. De två är medvetet separata flöden — Sales visar den råa försäljningen från Dropfans, Ekonomi är er egen bokföring. Om ni vill ha allt i en gemensam valuta/rapport är nästa steg att lägga till en valutaomräkning.
- Dropfans earnings-API returnerar max de 50 senaste transaktionerna åt gången (ingen paginering) — med synk var 5:e minut är det i praktiken aldrig ett problem, men vid en första synk efter lång tid utan körning kan enstaka äldre transaktioner missas. Kör synken en gång extra manuellt (öppna cron-URL:en i webbläsaren, eller vänta på nästa schemalagda körning) om ni är osäkra.

## Nästa steg / utbyggnad

- 2FA på inloggning (Supabase stödjer detta inbyggt, kan aktiveras senare).
- Fler roller/finmaskig behörighet per modell (t.ex. en chattare som bara ser sin egen modell).
- Automatisk löneberäkning i Kassa-vyn baserat på split + registrerade intäkter.
- Chattschema/bemanning, inläggsplanerare, röst-generering — kan byggas som separata moduler ovanpå samma grund när ni är redo.
- Export till bokföring (Fortnox/Bokio).
- Byt till riktiga webhooks från Dropfans så fort de släpper den funktionen (deras dokumentation säger "coming soon") — då försvinner polling-fördröjningen helt.
- Automatiskt skapa en `income`-rad i Ekonomi utifrån synkad Dropfans-försäljning, så Sales och Ekonomi hänger ihop utan manuell inmatning.

## Teknisk stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS 4)
- Supabase (Postgres, Auth, Realtime, Row Level Security)
- Vercel (hosting)
