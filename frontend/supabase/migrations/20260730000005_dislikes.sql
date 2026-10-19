create table if not exists dislikes (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at timestamptz default now(),
  unique (profile_id, tmdb_id, media_type)
);

alter table dislikes enable row level security;
create policy "Users can manage own dislikes" on dislikes for all using (auth.uid() = (select id from profiles where id = profile_id));
