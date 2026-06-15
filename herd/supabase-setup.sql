-- ─────────────────────────────────────────────────────────────────────────────
-- mentoring_pairs: 멘토링 배정 정보 (자동 메일 대상 테이블)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mentoring_pairs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_name          text NOT NULL DEFAULT '',
  mentor_email         text NOT NULL DEFAULT '',
  mentee_name          text NOT NULL DEFAULT '',
  join_date            text NOT NULL DEFAULT '',   -- YYYY-MM-DD (자동메일 기준일)
  join_month           text NOT NULL DEFAULT '',
  start_date           text NOT NULL DEFAULT '',
  end_date             text NOT NULL DEFAULT '',
  status               text NOT NULL DEFAULT 'active',  -- 'active' | 'completed' | 'deleted'
  upload_status        text NOT NULL DEFAULT 'waiting',
  upload_block_reason  text NOT NULL DEFAULT '',
  note                 text NOT NULL DEFAULT '',
  token                text UNIQUE,
  goals_expectations   jsonb,
  goals_cooperation    jsonb,
  goals_saved_at       timestamptz,
  initial_mail_sent    boolean NOT NULL DEFAULT false,
  initial_mail_sent_at timestamptz,
  end_mail_sent        boolean NOT NULL DEFAULT false,
  end_mail_sent_at     timestamptz,
  link_copied          boolean NOT NULL DEFAULT false,
  last_access_at       timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

ALTER TABLE public.mentoring_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.mentoring_pairs FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- activities: 멘토링 활동 기록
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id     uuid NOT NULL REFERENCES public.mentoring_pairs(id) ON DELETE CASCADE,
  month_index   int NOT NULL DEFAULT 1,
  activity_date text NOT NULL DEFAULT '',
  content       text NOT NULL DEFAULT '',
  memo          text NOT NULL DEFAULT '',
  photo_name    text NOT NULL DEFAULT '',
  photo_url     text NOT NULL DEFAULT '',
  has_cost      boolean NOT NULL DEFAULT false,
  cost_amount   numeric NOT NULL DEFAULT 0,
  receipt_name  text NOT NULL DEFAULT '',
  receipt_url   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- auto_mail_log: 자동 발송 메일 중복 방지 로그
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auto_mail_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id   uuid NOT NULL,
  mail_type   text NOT NULL,   -- 'd7' | 'd1' | 'dday' | 'post7' | 'post30'
  recipient   text,
  subject     text,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, mail_type)
);

-- RLS: anon도 읽기/쓰기 허용 (cron이 anon key 사용 시)
ALTER TABLE public.auto_mail_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.auto_mail_log FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- scheduled_mails: 예약 발송 메일
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_mails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    uuid,
  to_email     text NOT NULL,
  cc_email     text,
  subject      text NOT NULL,
  html         text NOT NULL,
  body_text    text,
  scheduled_at timestamptz NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'cancelled')),
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.scheduled_mails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON public.scheduled_mails FOR ALL USING (true) WITH CHECK (true);

-- 인덱스: pending 상태 + scheduled_at 조회 최적화
CREATE INDEX IF NOT EXISTS idx_scheduled_mails_pending
  ON public.scheduled_mails (scheduled_at)
  WHERE status = 'pending';
