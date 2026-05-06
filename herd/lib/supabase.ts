import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
