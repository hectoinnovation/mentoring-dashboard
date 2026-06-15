-- ─────────────────────────────────────────────────────────────────────────────
-- 입퇴사자 대시보드 — Supabase 추가 테이블 설정
-- Supabase SQL Editor에서 전체 실행 (IF NOT EXISTS → 중복 실행 안전)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── scheduled_mails: 예약 발송 메일 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scheduled_mails (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    uuid,                         -- 참조용 (optional)
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

ALTER TABLE public.scheduled_mails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'scheduled_mails' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON public.scheduled_mails
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 인덱스: pending 상태 + scheduled_at 조회 최적화
CREATE INDEX IF NOT EXISTS idx_scheduled_mails_pending
  ON public.scheduled_mails (scheduled_at)
  WHERE status = 'pending';

-- ── auto_mail_log: 중복 발송 방지 로그 (자동 메일 전용) ─────────────────────
-- 향후 직원 기준 자동 메일(D-7, D-1 등) 추가 시 사용
CREATE TABLE IF NOT EXISTS public.auto_mail_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   uuid NOT NULL,                 -- 대상 레코드 id (employees.id 등)
  mail_type   text NOT NULL,                 -- 예: 'd7' | 'd1' | 'dday' | 'post7' | 'post30'
  recipient   text,
  subject     text,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_id, mail_type)
);

ALTER TABLE public.auto_mail_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_mail_log' AND policyname = 'allow_all'
  ) THEN
    CREATE POLICY "allow_all" ON public.auto_mail_log
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
