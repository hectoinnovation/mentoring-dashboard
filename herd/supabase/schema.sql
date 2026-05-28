-- ─────────────────────────────────────────────────────────────────────────────
-- mentoring-dashboard Supabase schema
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ─────────────────────────────────────────────────────────────────────────────

-- ── mentors 테이블 ─────────────────────────────────────────────────────────────
create table if not exists public.mentors (
  id                   text primary key,
  mentor_name          text not null,
  mentor_email         text not null,
  mentee_name          text not null,
  join_date            text not null,
  join_month           text not null,
  start_date           text not null,
  end_date             text not null,
  status               text not null default 'active',
  upload_status        text not null default 'enabled',
  upload_block_reason  text not null default '',
  note                 text not null default '',
  token                text unique not null,
  goals_expectations   jsonb not null default '["","",""]'::jsonb,
  goals_cooperation    jsonb not null default '["","",""]'::jsonb,
  goals_saved_at       text,
  initial_mail_sent    boolean not null default false,
  initial_mail_sent_at text,
  end_mail_sent        boolean not null default false,
  end_mail_sent_at     text,
  link_copied          boolean not null default false,
  last_access_at       text,
  created_at           text not null,
  deleted_at           text
);

-- ── activities 테이블 ──────────────────────────────────────────────────────────
create table if not exists public.activities (
  id            text primary key,
  mentor_id     text not null references public.mentors(id) on delete cascade,
  month_index   integer not null check (month_index in (1, 2, 3)),
  activity_date text not null,
  content       text not null default '',
  memo          text not null default '',
  photo_name    text not null default '',
  photo_url     text not null default '',
  has_cost      boolean not null default false,
  cost_amount   integer not null default 0,
  receipt_name  text not null default '',
  receipt_url   text not null default '',
  created_at    timestamptz not null default now()
);

-- ── RLS (내부 관리 도구 — anon key 전체 허용) ──────────────────────────────────
alter table public.mentors    enable row level security;
alter table public.activities enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'mentors' and policyname = 'allow_all_mentors'
  ) then
    create policy "allow_all_mentors" on public.mentors
      for all using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'activities' and policyname = 'allow_all_activities'
  ) then
    create policy "allow_all_activities" on public.activities
      for all using (true) with check (true);
  end if;
end $$;

-- ── Storage bucket (mentoring-files) ──────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('mentoring-files', 'mentoring-files', true)
  on conflict (id) do nothing;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'allow_all_mentoring_storage'
  ) then
    create policy "allow_all_mentoring_storage" on storage.objects
      for all
      using  (bucket_id = 'mentoring-files')
      with check (bucket_id = 'mentoring-files');
  end if;
end $$;
