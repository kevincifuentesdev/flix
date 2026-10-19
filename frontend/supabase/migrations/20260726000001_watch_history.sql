create table if not exists watch_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  tmdb_id bigint not null,                    -- TMDB movie/TV ID
  media_type text not null check (media_type in ('movie', 'tv')),
  title text,                                 -- Saved title
  poster_path text,                           -- Saved poster path
  season_number int,                          -- null for movies
  episode_number int,                         -- null for movies
  episode_tmdb_id bigint,                     -- TMDB episode ID
  progress_seconds int default 0,
  duration_seconds int,
  completed boolean default false,
  completed_at timestamptz,
  mux_playback_id text,                       -- For resume
  device text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, tmdb_id, media_type, season_number, episode_number)
);

create index idx_watch_history_profile_updated on watch_history(profile_id, updated_at desc);
create index idx_watch_history_continue on watch_history(profile_id, completed, updated_at desc) 
  where completed = false and progress_seconds > 0;

alter table watch_history enable row level security;
create policy "Users can view own watch history" on watch_history for select using (auth.uid() = user_id);
create policy "Users can insert own watch history" on watch_history for insert with check (auth.uid() = user_id);
create policy "Users can update own watch history" on watch_history for update using (auth.uid() = user_id);
