-- Extend existing profiles table
alter table profiles add column if not exists language text default 'en';
alter table profiles add column if not exists maturity_rating text default 'TV-MA';
alter table profiles add column if not exists is_kids boolean default false;
