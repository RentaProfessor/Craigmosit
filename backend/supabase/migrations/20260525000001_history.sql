-- PlantWatch: long-term moisture history.
-- Safe to run multiple times. Does not touch any other table.
-- The 'plantwatch_' prefix keeps it isolated from any existing app
-- that uses the public schema.
--
-- Ecowitt retains ~3 months of detail; this table keeps the full record so we
-- can spot seasonal patterns ("Hydrangea always dries in August") and feed a
-- future per-plant drying-rate model.

create table if not exists public.plantwatch_soil_readings (
  id        bigserial primary key,
  ts        timestamptz   not null default now(),
  zone      text          not null,                       -- "Back Yard" / "Side Yards"
  channel   int           not null check (channel between 1 and 16),
  plant     text          not null,                       -- denormalised so renames stay traceable
  moisture  int           not null check (moisture between 0 and 100),
  battery   numeric(4,2)
);

create index if not exists plantwatch_soil_readings_zone_channel_ts_idx
  on public.plantwatch_soil_readings (zone, channel, ts desc);

create index if not exists plantwatch_soil_readings_plant_ts_idx
  on public.plantwatch_soil_readings (plant, ts desc);

-- RLS: nothing in this project reads or writes from a browser session,
-- only the edge function (service role) does — so we lock it down hard.
alter table public.plantwatch_soil_readings enable row level security;
-- No policies created: service role bypasses RLS, every other role is denied.
