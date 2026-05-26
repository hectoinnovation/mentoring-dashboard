-- ============================================================
-- 멘토링 운영 대시보드 DB 스키마
-- Supabase SQL Editor에서 실행하세요
-- ============================================================

-- 1. 멘토링 페어 테이블
CREATE TABLE IF NOT EXISTS mentoring_pairs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_name   TEXT NOT NULL,
  mentor_email  TEXT NOT NULL,
  mentee_name   TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  current_month INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','completed','finished')),
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 기대사항 / 협력사항 테이블
CREATE TABLE IF NOT EXISTS mentor_expectations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id    UUID NOT NULL REFERENCES mentoring_pairs(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('mentor','mentee')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 활동 기록 테이블
CREATE TABLE IF NOT EXISTS mentor_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id         UUID NOT NULL REFERENCES mentoring_pairs(id) ON DELETE CASCADE,
  month_no        INTEGER NOT NULL CHECK (month_no IN (1,2,3)),
  round_no        INTEGER NOT NULL CHECK (round_no IN (1,2,3)),
  activity_date   DATE,
  activity_text   TEXT,
  image_url       TEXT,
  proposal_checked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pair_id, month_no, round_no)
);

-- 4. 지급 정산 테이블
CREATE TABLE IF NOT EXISTS payment_summary (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id         UUID NOT NULL REFERENCES mentoring_pairs(id) ON DELETE CASCADE,
  month_no        INTEGER NOT NULL CHECK (month_no IN (1,2,3)),
  activity_count  INTEGER NOT NULL DEFAULT 0,
  proposal_count  INTEGER NOT NULL DEFAULT 0,
  payment_amount  INTEGER NOT NULL DEFAULT 0,
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                  CHECK (payment_status IN ('pending','approved','paid')),
  UNIQUE (pair_id, month_no)
);

-- 5. 영수증 테이블 (신규)
CREATE TABLE IF NOT EXISTS mentoring_receipts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id     UUID NOT NULL REFERENCES mentoring_pairs(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES mentor_activities(id) ON DELETE SET NULL,
  month_no    INTEGER NOT NULL CHECK (month_no IN (1,2,3)),
  receipt_url TEXT NOT NULL,
  file_name   TEXT,
  mail_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 메일 발송 로그 테이블 (신규)
CREATE TABLE IF NOT EXISTS mentoring_mail_logs (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_id   UUID REFERENCES mentoring_pairs(id) ON DELETE SET NULL,
  mail_type TEXT NOT NULL,
  to_email  TEXT NOT NULL,
  subject   TEXT NOT NULL,
  success   BOOLEAN NOT NULL DEFAULT TRUE,
  error_msg TEXT,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE mentoring_pairs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_expectations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_summary      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_receipts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentoring_mail_logs  ENABLE ROW LEVEL SECURITY;

-- 멘토 전용: token으로 본인 페어만 접근
CREATE POLICY "mentor_read_own_pair" ON mentoring_pairs
  FOR SELECT USING (TRUE);  -- token 검증은 앱 레이어에서 처리

CREATE POLICY "allow_all_expectations" ON mentor_expectations
  FOR ALL USING (TRUE);

CREATE POLICY "allow_all_activities" ON mentor_activities
  FOR ALL USING (TRUE);

CREATE POLICY "allow_all_payment" ON payment_summary
  FOR ALL USING (TRUE);

CREATE POLICY "allow_all_receipts" ON mentoring_receipts
  FOR ALL USING (TRUE);

CREATE POLICY "allow_all_mail_logs" ON mentoring_mail_logs
  FOR ALL USING (TRUE);

-- ============================================================
-- Storage Buckets
-- Supabase Dashboard > Storage > New Bucket:
--   1. mentor-activity-images  (Public: true)
--   2. mentor-receipt-files    (Public: true)
-- ============================================================

-- ============================================================
-- 샘플 데이터 (테스트용)
-- ============================================================

INSERT INTO mentoring_pairs (mentor_name, mentor_email, mentee_name, start_date, end_date, current_month, status, token)
VALUES
  ('김멘토', 'kim@hecto.co.kr', '이멘티', '2026-05-01', '2026-07-31', 1, 'active', 'mentor_a1'),
  ('박멘토', 'park@hecto.co.kr', '최멘티', '2026-04-01', '2026-06-30', 2, 'active', 'mentor_b2'),
  ('테스트멘토', 'test@hecto.co.kr', '테스트멘티', '2026-05-01', '2026-07-31', 1, 'active', 'test')
ON CONFLICT (token) DO NOTHING;
