-- A PostgreSQL unique constraint considers NULL values distinct. Movies have
-- no season or episode, so normalize them to 0 before relying on upsert.
-- If older progress rows are duplicated, retain the most recently updated one.
with ranked_history as (
  select
    id,
    row_number() over (
      partition by profile_id, tmdb_id, media_type,
        coalesce(season_number, 0), coalesce(episode_number, 0)
      order by updated_at desc nulls last, id desc
    ) as rank
  from watch_history
)
delete from watch_history
using ranked_history
where watch_history.id = ranked_history.id
  and ranked_history.rank > 1;

update watch_history
set season_number = coalesce(season_number, 0),
    episode_number = coalesce(episode_number, 0)
where season_number is null or episode_number is null;

alter table watch_history
  alter column season_number set default 0,
  alter column episode_number set default 0,
  alter column season_number set not null,
  alter column episode_number set not null;
