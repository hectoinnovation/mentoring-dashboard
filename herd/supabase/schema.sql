-- ─────────────────────────────────────────────────────────────────────────────
-- mentoring-dashboard Supabase schema  (완전 idempotent — 몇 번 실행해도 안전)
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. mentoring_pairs 누락 컬럼 추가 ────────────────────────────────────────
-- 이미 존재하는 컬럼은 무시하며, 없는 컬럼만 추가됩니다.

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

-- token unique constraint (없을 때만 추가)
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.mentoring_pairs'::regclass
      and contype = 'u'
      and conname = 'mentoring_pairs_token_key'
  ) then
    alter table public.mentoring_pairs add constraint mentoring_pairs_token_key unique (token);
  end if;
end $$;

-- ── 2. activities 테이블 (신규 생성) ─────────────────────────────────────────
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

-- ── 3. RLS 활성화 (이미 활성화된 경우 skip — 자동 policy 재생성 방지) ──────────
do $$ begin
  -- mentoring_pairs: relrowsecurity = false 일 때만 ENABLE
  if not (
    select relrowsecurity from pg_class
    where oid = 'public.mentoring_pairs'::regclass
  ) then
    execute 'alter table public.mentoring_pairs enable row level security';
  end if;
end $$;

-- activities는 새 테이블이므로 직접 활성화
alter table public.activities enable row level security;

-- ── 4. Policy: mentoring_pairs — 전체 허용 (내부 관리 도구용) ─────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'mentoring_pairs'
      and policyname = 'allow_all_mentoring_pairs'
  ) then
    execute $p$
      create policy "allow_all_mentoring_pairs"
        on public.mentoring_pairs
        for all
        using (true)
        with check (true)
    $p$;
  end if;
end $$;

-- ── 5. Policy: activities — 전체 허용 ─────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'activities'
      and policyname = 'allow_all_activities'
  ) then
    execute $p$
      create policy "allow_all_activities"
        on public.activities
        for all
        using (true)
        with check (true)
    $p$;
  end if;
end $$;

-- ── 6. Storage bucket (mentoring-files) ───────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('mentoring-files', 'mentoring-files', true)
  on conflict (id) do nothing;

-- ── 7. Storage Policy ─────────────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and policyname = 'allow_all_mentoring_storage'
  ) then
    execute $p$
      create policy "allow_all_mentoring_storage"
        on storage.objects
        for all
        using  (bucket_id = 'mentoring-files')
        with check (bucket_id = 'mentoring-files')
    $p$;
  end if;
end $$;
