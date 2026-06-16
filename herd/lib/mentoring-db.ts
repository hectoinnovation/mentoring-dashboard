/**
 * lib/mentoring-db.ts — Supabase CRUD for mentoring dashboard
 * mentoring_pairs / activities 테이블 + mentoring-files Storage 연동
 */
import { supabase } from './supabase'
import type {
  MentoringRecord, ActivityEntry, MentoringGoals, MonthData,
} from './mentoring'

// ─────────────────────────────────────────────────────────────────────────────
// DB row types
// ─────────────────────────────────────────────────────────────────────────────

interface DbMentor {
  id:                   string
  mentor_name:          string
  mentor_email:         string
  mentee_name:          string
  join_date:            string
  join_month:           string
  start_date:           string
  end_date:             string
  status:               string
  upload_status:        string
  upload_block_reason:  string
  note:                 string
  token:                string
  goals_expectations:   unknown  // jsonb → cast to string[]
  goals_cooperation:    unknown
  goals_saved_at:       string | null
  initial_mail_sent:    boolean
  initial_mail_sent_at: string | null
  end_mail_sent:        boolean
  end_mail_sent_at:     string | null
  link_copied:          boolean
  last_access_at:       string | null
  created_at:           string
  deleted_at:           string | null
  month1_closed:        boolean | null
  month1_closed_at:     string | null
  month2_closed:        boolean | null
  month2_closed_at:     string | null
  month3_closed:        boolean | null
  month3_closed_at:     string | null
}

interface DbActivity {
  id:            string
  mentor_id:     string
  month_index:   number
  activity_date: string
  content:       string
  memo:          string
  photo_name:    string
  photo_url:     string
  has_cost:      boolean
  cost_amount:   number
  receipt_name:  string
  receipt_url:   string
  created_at:    string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

function toEntry(a: DbActivity): ActivityEntry {
  return {
    id:           a.id,
    activityDate: a.activity_date,
    content:      a.content,
    memo:         a.memo,
    photoName:    a.photo_name,
    photoUrl:     a.photo_url,
    hasCost:      a.has_cost,
    costAmount:   a.cost_amount,
    receiptName:  a.receipt_name,
    receiptUrl:   a.receipt_url,
  }
}

function toRecord(m: DbMentor, acts: DbActivity[]): MentoringRecord {
  const months: MonthData[] = ([1, 2, 3] as const).map(mi => ({
    monthIndex: mi,
    activities: acts.filter(a => a.month_index === mi).map(toEntry),
  }))

  const exp = (m.goals_expectations as string[] | null) ?? ['', '', '']
  const coo = (m.goals_cooperation  as string[] | null) ?? ['', '', '']

  return {
    id:                m.id,
    mentorName:        m.mentor_name,
    mentorEmail:       m.mentor_email,
    menteeName:        m.mentee_name,
    joinDate:          m.join_date,
    joinMonth:         m.join_month,
    startDate:         m.start_date,
    endDate:           m.end_date,
    status:            m.status            as MentoringRecord['status'],
    uploadStatus:      m.upload_status     as MentoringRecord['uploadStatus'],
    uploadBlockReason: m.upload_block_reason,
    note:              m.note,
    token:             m.token,
    months,
    goals: {
      expectations: [exp[0] ?? '', exp[1] ?? '', exp[2] ?? ''] as [string, string, string],
      cooperation:  [coo[0] ?? '', coo[1] ?? '', coo[2] ?? ''] as [string, string, string],
      savedAt:      m.goals_saved_at,
    },
    initialMailSent:    m.initial_mail_sent,
    initialMailSentAt:  m.initial_mail_sent_at,
    endMailSent:        m.end_mail_sent,
    endMailSentAt:      m.end_mail_sent_at,
    linkCopied:         m.link_copied,
    lastAccessAt:       m.last_access_at,
    createdAt:          m.created_at,
    deletedAt:          m.deleted_at,
    month1Closed:   m.month1_closed   ?? false,
    month1ClosedAt: m.month1_closed_at ?? null,
    month2Closed:   m.month2_closed   ?? false,
    month2ClosedAt: m.month2_closed_at ?? null,
    month3Closed:   m.month3_closed   ?? false,
    month3ClosedAt: m.month3_closed_at ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllMentors(): Promise<MentoringRecord[]> {
  const [{ data: mentors, error: mErr }, { data: activities, error: aErr }] = await Promise.all([
    supabase.from('mentoring_pairs').select('*').order('created_at', { ascending: true }),
    supabase.from('activities').select('*').order('created_at', { ascending: true }),
  ])
  if (mErr) throw mErr
  if (aErr) throw aErr
  const acts = (activities ?? []) as DbActivity[]
  return ((mentors ?? []) as DbMentor[]).map(m =>
    toRecord(m, acts.filter(a => a.mentor_id === m.id))
  )
}

export async function fetchMentorByToken(token: string): Promise<MentoringRecord | null> {
  const { data: mentor, error } = await supabase
    .from('mentoring_pairs')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  if (error || !mentor) return null

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('mentor_id', (mentor as DbMentor).id)
    .order('created_at', { ascending: true })

  return toRecord(mentor as DbMentor, (activities ?? []) as DbActivity[])
}

// ─────────────────────────────────────────────────────────────────────────────
// Mentor CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function insertMentor(r: MentoringRecord): Promise<void> {
  const payload = {
    id:                   r.id,
    mentor_name:          r.mentorName,
    mentor_email:         r.mentorEmail,
    mentee_name:          r.menteeName,
    join_date:            r.joinDate,
    join_month:           r.joinMonth,
    start_date:           r.startDate,
    end_date:             r.endDate,
    status:               r.status,
    upload_status:        r.uploadStatus,
    upload_block_reason:  r.uploadBlockReason,
    note:                 r.note,
    token:                r.token,
    goals_expectations:   r.goals.expectations,
    goals_cooperation:    r.goals.cooperation,
    goals_saved_at:       r.goals.savedAt,
    initial_mail_sent:    r.initialMailSent,
    initial_mail_sent_at: r.initialMailSentAt,
    end_mail_sent:        r.endMailSent,
    end_mail_sent_at:     r.endMailSentAt,
    link_copied:          r.linkCopied,
    last_access_at:       r.lastAccessAt,
    created_at:           r.createdAt,
    deleted_at:           r.deletedAt,
    month1_closed:        r.month1Closed,
    month1_closed_at:     r.month1ClosedAt,
    month2_closed:        r.month2Closed,
    month2_closed_at:     r.month2ClosedAt,
    month3_closed:        r.month3Closed,
    month3_closed_at:     r.month3ClosedAt,
  }
  console.log('[insertMentor] payload:', payload)
  const { error } = await supabase.from('mentoring_pairs').insert(payload)
  if (error) {
    console.error('[insertMentor] Supabase error:', error)
    throw error
  }
}

export type MentorPatch = Partial<{
  mentor_name:          string
  mentor_email:         string
  mentee_name:          string
  join_date:            string
  join_month:           string
  start_date:           string
  end_date:             string
  status:               string
  upload_status:        string
  upload_block_reason:  string
  note:                 string
  goals_expectations:   string[]
  goals_cooperation:    string[]
  goals_saved_at:       string | null
  initial_mail_sent:    boolean
  initial_mail_sent_at: string | null
  end_mail_sent:        boolean
  end_mail_sent_at:     string | null
  link_copied:          boolean
  last_access_at:       string | null
  deleted_at:           string | null
  month1_closed:        boolean
  month1_closed_at:     string | null
  month2_closed:        boolean
  month2_closed_at:     string | null
  month3_closed:        boolean
  month3_closed_at:     string | null
}>

export async function patchMentor(id: string, fields: MentorPatch): Promise<void> {
  const { error } = await supabase.from('mentoring_pairs').update(fields).eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Month closure
// ─────────────────────────────────────────────────────────────────────────────

export async function setMonthClosed(
  mentorId: string,
  monthIndex: 1 | 2 | 3,
  closed: boolean,
): Promise<void> {
  const now = closed ? new Date().toISOString().slice(0, 10) : null
  if (monthIndex === 1)
    await patchMentor(mentorId, { month1_closed: closed, month1_closed_at: now })
  else if (monthIndex === 2)
    await patchMentor(mentorId, { month2_closed: closed, month2_closed_at: now })
  else
    await patchMentor(mentorId, { month3_closed: closed, month3_closed_at: now })
}

// ─────────────────────────────────────────────────────────────────────────────
// File upload (Storage: mentoring-files bucket)
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'mentoring-files'

export async function uploadFile(
  mentorId: string,
  activityId: string,
  type: 'photo' | 'receipt',
  file: File,
): Promise<{ name: string; url: string }> {
  const ext  = file.name.split('.').pop() ?? 'bin'
  const path = `${mentorId}/${activityId}_${type}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { name: file.name, url: data.publicUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function dbInsertActivity(
  mentorId: string,
  monthIndex: 1 | 2 | 3,
  activity: ActivityEntry,
  photoFile?: File,
  receiptFile?: File,
): Promise<ActivityEntry> {
  let { photoName, photoUrl, receiptName, receiptUrl } = activity

  if (photoFile) {
    const r = await uploadFile(mentorId, activity.id, 'photo', photoFile)
    photoName = r.name
    photoUrl  = r.url
  }
  if (receiptFile && activity.hasCost) {
    const r = await uploadFile(mentorId, activity.id, 'receipt', receiptFile)
    receiptName = r.name
    receiptUrl  = r.url
  }

  const { error } = await supabase.from('activities').insert({
    id:            activity.id,
    mentor_id:     mentorId,
    month_index:   monthIndex,
    activity_date: activity.activityDate,
    content:       activity.content,
    memo:          activity.memo,
    photo_name:    photoName,
    photo_url:     photoUrl,
    has_cost:      activity.hasCost,
    cost_amount:   activity.costAmount,
    receipt_name:  receiptName,
    receipt_url:   receiptUrl,
  })
  if (error) throw error

  return { ...activity, photoName, photoUrl, receiptName, receiptUrl }
}

export async function dbUpdateActivity(
  mentorId: string,
  activity: ActivityEntry,
  photoFile?: File,
  receiptFile?: File,
): Promise<ActivityEntry> {
  let { photoName, photoUrl, receiptName, receiptUrl } = activity

  if (photoFile) {
    const r = await uploadFile(mentorId, activity.id, 'photo', photoFile)
    photoName = r.name
    photoUrl  = r.url
  }
  if (receiptFile && activity.hasCost) {
    const r = await uploadFile(mentorId, activity.id, 'receipt', receiptFile)
    receiptName = r.name
    receiptUrl  = r.url
  }
  if (!activity.hasCost) {
    receiptName = ''
    receiptUrl  = ''
  }

  const { error } = await supabase.from('activities').update({
    activity_date: activity.activityDate,
    content:       activity.content,
    memo:          activity.memo,
    photo_name:    photoName,
    photo_url:     photoUrl,
    has_cost:      activity.hasCost,
    cost_amount:   activity.costAmount,
    receipt_name:  receiptName,
    receipt_url:   receiptUrl,
  }).eq('id', activity.id)
  if (error) throw error

  return { ...activity, photoName, photoUrl, receiptName, receiptUrl }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete activity (DB row + Storage files)
// ─────────────────────────────────────────────────────────────────────────────

/** Supabase public URL → storage path (bucket 이하 경로만 추출) */
function storagePathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const marker = `/object/public/${BUCKET}/`
    const idx    = urlObj.pathname.indexOf(marker)
    if (idx === -1) return null
    return decodeURIComponent(urlObj.pathname.slice(idx + marker.length))
  } catch {
    return null
  }
}

export async function dbDeleteActivity(activity: ActivityEntry): Promise<void> {
  // 1) Storage 파일 삭제 (photo + receipt, best-effort)
  const paths: string[] = []
  if (activity.photoUrl)   { const p = storagePathFromUrl(activity.photoUrl);   if (p) paths.push(p) }
  if (activity.receiptUrl) { const p = storagePathFromUrl(activity.receiptUrl); if (p) paths.push(p) }

  if (paths.length > 0) {
    const { error: sErr } = await supabase.storage.from(BUCKET).remove(paths)
    if (sErr) console.warn('[dbDeleteActivity] storage remove error:', sErr)
  }

  // 2) DB row 삭제
  const { error } = await supabase.from('activities').delete().eq('id', activity.id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete mentor (hard delete: storage → activities → mentor row)
// ─────────────────────────────────────────────────────────────────────────────

export async function dbDeleteMentor(record: MentoringRecord): Promise<void> {
  // 1) 스토리지 파일 삭제 (사진 + 영수증, best-effort)
  const storagePaths: string[] = []
  for (const month of record.months) {
    for (const act of month.activities) {
      if (act.photoUrl)   { const p = storagePathFromUrl(act.photoUrl);   if (p) storagePaths.push(p) }
      if (act.receiptUrl) { const p = storagePathFromUrl(act.receiptUrl); if (p) storagePaths.push(p) }
    }
  }
  if (storagePaths.length > 0) {
    const { error: sErr } = await supabase.storage.from(BUCKET).remove(storagePaths)
    if (sErr) console.warn('[dbDeleteMentor] storage remove error:', sErr)
  }

  // 2) activities 행 삭제 (FK cascade 없을 경우를 대비해 명시적으로 삭제)
  const activityIds = record.months.flatMap(m => m.activities.map(a => a.id))
  if (activityIds.length > 0) {
    const { error: aErr } = await supabase.from('activities').delete().in('id', activityIds)
    if (aErr) console.warn('[dbDeleteMentor] activities delete error:', aErr)
  }

  // 3) mentoring_pairs 행 삭제
  const { error } = await supabase.from('mentoring_pairs').delete().eq('id', record.id)
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// Goals & last access
// ─────────────────────────────────────────────────────────────────────────────

export async function saveGoals(mentorId: string, goals: MentoringGoals): Promise<void> {
  await patchMentor(mentorId, {
    goals_expectations: goals.expectations,
    goals_cooperation:  goals.cooperation,
    goals_saved_at:     goals.savedAt,
  })
}

export async function updateLastAccess(mentorId: string, date: string): Promise<void> {
  await patchMentor(mentorId, { last_access_at: date }).catch(console.error)
}
