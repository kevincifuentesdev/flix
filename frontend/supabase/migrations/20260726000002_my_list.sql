create table if not exists my_list (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  tmdb_id bigint not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at timestamptz default now(),
  unique (profile_id, tmdb_id, media_type)
);

alter table my_list enable row level security;
create policy "Users can manage own list" on my_list for all using (auth.uid() = (select id from profiles where id = profile_id));
