-- ─────────────────────────────────────────────────────────────────────────────
-- mentoring-dashboard Supabase schema  (완전 idempotent · 몇 번 실행해도 안전)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. mentoring_pairs — 누락 컬럼 추가
--    ADD COLUMN IF NOT EXISTS: 이미 있는 컬럼은 무시
-- ══════════════════════════════════════════════════════════════════════════════
alter table public.mentoring_pairs
  add column if not exists mentor_name          text    not null default '',
  add column if not exists mentor_email         text    not null default '',
  add column if not exists mentee_name          text    not null default '',
  add column if not exists join_date            text    not null default '',
  add column if not exists join_month           text    not null default '',
  add column if not exists start_date           text    not null default '',
  add column if not exists end_date             text    not null default '',
  add column if not exists status               text    not null default 'active',
  add column if not exists upload_status        text    not null default 'enabled',
  add column if not exists upload_block_reason  text    not null default '',
  add column if not exists note                 text    not null default '',
  add column if not exists token                text,
  add column if not exists goals_expectations   jsonb   not null default '["","",""]'::jsonb,
  add column if not exists goals_cooperation    jsonb   not null default '["","",""]'::jsonb,
  add column if not exists goals_saved_at       text,
  add column if not exists initial_mail_sent    boolean not null default false,
  add column if not exists initial_mail_sent_at text,
  add column if not exists end_mail_sent        boolean not null default false,
  add column if not exists end_mail_sent_at     text,
  add column if not exists link_copied          boolean not null default false,
  add column if not exists last_access_at       text,
  add column if not exists created_at           text,
  add column if not exists deleted_at           text;

-- token unique constraint (중복 방지)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mentoring_pairs'::regclass
      and contype  = 'u'
      and conname  = 'mentoring_pairs_token_key'
  ) then
    alter table public.mentoring_pairs
      add constraint mentoring_pairs_token_key unique (token);
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. activities — 신규 생성 (이미 존재하면 무시)
-- ══════════════════════════════════════════════════════════════════════════════
create table if not exists public.activities (
  id            text        primary key,
  mentor_id     text        not null references public.mentoring_pairs(id) on delete cascade,
  month_index   integer     not null check (month_index in (1, 2, 3)),
  activity_date text        not null,
  content       text        not null default '',
  memo          text        not null default '',
  photo_name    text        not null default '',
  photo_url     text        not null default '',
  has_cost      boolean     not null default false,
  cost_amount   integer     not null default 0,
  receipt_name  text        not null default '',
  receipt_url   text        not null default '',
  created_at    timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS 활성화
--    이미 활성화된 테이블은 skip (재실행 시 자동 policy 재생성 방지)
-- ══════════════════════════════════════════════════════════════════════════════
do $$ begin
  if not (
    select relrowsecurity from pg_class
    where relname = 'mentoring_pairs'
      and relnamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    execute 'alter table public.mentoring_pairs enable row level security';
  end if;
end $$;

do $$ begin
  if not (
    select relrowsecurity from pg_class
    where relname = 'activities'
      and relnamespace = (select oid from pg_namespace where nspname = 'public')
  ) then
    execute 'alter table public.activities enable row level security';
  end if;
end $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Policy 재설정 — DROP IF EXISTS → CREATE
--    중복 오류 근본 해결: 기존 policy를 먼저 삭제 후 재생성
--    mentor_read_own_pair 포함 모든 기존 policy를 안전하게 정리
-- ══════════════════════════════════════════════════════════════════════════════

-- mentoring_pairs: 기존 policy 전체 정리 (어떤 이름이든 안전하게 삭제)
drop policy if exists "mentor_read_own_pair"       on public.mentoring_pairs;
drop policy if exists "allow_all_mentoring_pairs"  on public.mentoring_pairs;
drop policy if exists "mentoring_pairs_policy"     on public.mentoring_pairs;
drop policy if exists "enable_all_for_anon"        on public.mentoring_pairs;

-- mentoring_pairs: 내부 관리 도구용 전체 허용 policy 생성
create policy "allow_all_mentoring_pairs"
  on public.mentoring_pairs
  for all
  using  (true)
  with check (true);

-- activities: 기존 policy 정리
drop policy if exists "allow_all_activities"       on public.activities;
drop policy if exists "activities_policy"          on public.activities;
drop policy if exists "enable_all_for_anon"        on public.activities;

-- activities: 전체 허용 policy 생성
create policy "allow_all_activities"
  on public.activities
  for all
  using  (true)
  with check (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Storage bucket (mentoring-files)
-- ══════════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
  values ('mentoring-files', 'mentoring-files', true)
  on conflict (id) do nothing;

-- Storage policy: DROP IF EXISTS → CREATE
drop policy if exists "allow_all_mentoring_storage" on storage.objects;

create policy "allow_all_mentoring_storage"
  on storage.objects
  for all
  using  (bucket_id = 'mentoring-files')
  with check (bucket_id = 'mentoring-files');
