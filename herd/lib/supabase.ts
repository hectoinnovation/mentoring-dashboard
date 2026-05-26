import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// ─── 입퇴사자 관리 테이블 타입 ────────────────────────────────────────────────

export interface Employee {
  id:         string
  name:       string
  join_date:  string | null
  leave_date: string | null
  division:   string | null
  team:       string | null
  leader:     string | null
  status:     'active' | 'resigned'
  created_at: string
  updated_at: string
}

export interface OnboardingTask {
  id:           string
  employee_id:  string
  stage_id:     string
  stage_label:  string
  timing:       string
  sort_order:   number
  is_done:      boolean
  done_at:      string | null
  mail_sent:    boolean
  mail_sent_at: string | null
  created_at:   string
  updated_at:   string
}

export interface PointRequest {
  id:                string
  employee_id:       string
  employee_type:     'hire' | 'leave'
  point_type:        'cafe' | 'wellness'
  base_month:        string
  excel_checked:     boolean
  calculated_amount: number | null
  extra_recipients:  string[]
  mail_subject:      string | null
  mail_sent:         boolean
  mail_sent_at:      string | null
  created_at:        string
  updated_at:        string
}

export interface Notification {
  id:                string
  employee_id:       string
  notification_type: 'hire' | 'leave'
  fixed_recipients:  string[]
  extra_recipients:  string[]
  mail_subject:      string | null
  mail_sent:         boolean
  mail_sent_at:      string | null
  created_at:        string
  updated_at:        string
}

// ─── 멘토링 대시보드 추가 타입 ────────────────────────────────────────────────

export interface MentoringReceipt {
  id: string
  mentor_token: string
  month_index: number
  round: number
  file_url: string
  file_name: string
  uploaded_at: string
}

export interface MailLog {
  id: string
  mentor_token: string
  mail_type: 'initial_guide' | 'monthly_proposal' | 'receipt_notify'
  recipient: string
  sent_at: string
}

// ─── 레거시 타입 (구 행사 참석 대시보드 컴포넌트 호환) ────────────────────────
export type ResponseStatus = 'attending' | 'not_attending' | 'pending'
export type Priority = 'high' | 'normal' | 'low'

export interface Event {
  id: string
  title: string
  event_type: string
  event_date: string
  description: string | null
  created_at: string
}

export interface ParticipantResponse {
  id: string
  name: string
  email: string
  priority: Priority
  department_name: string
  response_status: ResponseStatus
  responded_at: string | null
}

export interface DepartmentStat {
  department_name: string
  total: number
  attending: number
  not_attending: number
  pending: number
}
