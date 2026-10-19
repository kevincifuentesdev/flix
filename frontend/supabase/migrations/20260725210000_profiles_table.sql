-- Create a table for public profiles
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  plan text default 'free'::text,
  member_since timestamp with time zone default timezone('utc'::text, now()),
  region text,

  primary key (id)
);

alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Set up Realtime!
alter publication supabase_realtime add table profiles;
