-- 통통뱀터 — Supabase schema + RLS
-- Dashboard → SQL Editor에 이 파일 전체를 붙여 넣고 Run.
-- Authentication → Providers → Email 사용.
-- 캠프/로컬: Authentication → Providers → Email → Confirm email 끄기.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case
      when exists (select 1 from public.profiles where role = 'admin') then 'user'
      else 'admin'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.documents (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  raw_text text,
  lang text,
  rate numeric,
  created_at bigint,
  sentence_count int,
  source_lang text,
  cached_sentences jsonb,
  tags jsonb,
  difficulty_score numeric,
  difficulty_level int,
  difficulty_stars int,
  sentences_per_day int,
  translate_guidance jsonb,
  updated_at bigint
);

create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);

create table if not exists public.attempts (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id text,
  sentence_id text,
  kind text,
  mark_index int,
  document_title text,
  started_at bigint,
  finished_at bigint,
  duration_ms bigint,
  sentence_count int,
  retry_count int,
  write_count int,
  replay_count int,
  avg_wpm numeric,
  avg_accuracy numeric,
  score numeric,
  tier_label text,
  created_at bigint
);

create unique index if not exists attempts_user_sentence_idx
  on public.attempts (user_id, sentence_id)
  where sentence_id is not null;

create index if not exists attempts_user_doc_idx
  on public.attempts (user_id, document_id);

create table if not exists public.daily_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date_key text not null,
  sentences int not null default 0,
  duration_ms bigint not null default 0,
  retries int not null default 0,
  memorized_retries int not null default 0,
  writes int not null default 0,
  word_mistakes jsonb not null default '{}'::jsonb,
  primary key (user_id, date_key)
);

create table if not exists public.roadmap_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id text not null,
  completed_mark_indices jsonb not null default '[]'::jsonb,
  mark_durations jsonb not null default '{}'::jsonb,
  updated_at bigint,
  primary key (user_id, document_id)
);

create table if not exists public.vault_sentences (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  en_text text,
  ko_text text,
  source_lang text,
  status text,
  translate_guidance jsonb,
  created_at bigint,
  memorized_at bigint,
  updated_at bigint
);

create index if not exists vault_user_created_idx
  on public.vault_sentences (user_id, created_at desc);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  single_translate_guidance jsonb,
  translate_settings jsonb
);

create table if not exists public.app_settings (
  id text primary key,
  boa_states jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id, boa_states)
values ('global', null)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.attempts enable row level security;
alter table public.daily_stats enable row level security;
alter table public.roadmap_progress enable row level security;
alter table public.vault_sentences enable row level security;
alter table public.user_settings enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists documents_own on public.documents;
create policy documents_own on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists attempts_own on public.attempts;
create policy attempts_own on public.attempts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists daily_stats_own on public.daily_stats;
create policy daily_stats_own on public.daily_stats
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists roadmap_own on public.roadmap_progress;
create policy roadmap_own on public.roadmap_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists vault_own on public.vault_sentences;
create policy vault_own on public.vault_sentences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists user_settings_own on public.user_settings;
create policy user_settings_own on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (true);

drop policy if exists app_settings_admin on public.app_settings;
create policy app_settings_admin on public.app_settings
  for update using (public.is_admin()) with check (public.is_admin());

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
