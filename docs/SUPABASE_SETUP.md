# Supabase Setup Instructies

Om de cloud-cache te activeren, moet je een gratis Supabase project aanmaken en de volgende stappen volgen:

## 1. Tabel Aanmaken
Voer de volgende SQL uit in de **Supabase SQL Editor**:

```sql
create table poi_cache (
  id uuid default gen_random_uuid() primary key,
  cache_key text unique not null,
  data jsonb not null,
  language text default 'nl',
  created_at timestamp with time zone default now()
);

-- Maak een index voor razendsnelle zoekopdrachten
create index idx_poi_cache_key on poi_cache (cache_key);
```

## 2. Environment Variables toevoegen
Voeg deze toe aan je **Netlify Dashboard** (of je lokale `.env`):

*   `SUPABASE_URL`: De URL van je Supabase project (bijv. `https://xyz.supabase.co`).
*   `SUPABASE_SERVICE_ROLE_KEY`: De **service_role** key (niet de anon key!). Dit is nodig omdat de Netlify function schrijftoegang moet hebben tot de tabel.

## 3. Deployment
Zodra de variabelen zijn ingesteld en de tabel bestaat, zal de app automatisch beginnen met het opslaan en ophalen van resultaten via de cloud.
