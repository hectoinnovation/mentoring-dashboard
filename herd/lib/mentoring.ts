/**
 * lib/mentoring.ts — mentoring-dashboard 전용
 * Supabase 연결 전 mock/local 상태로 운영
 * React 의존성 없음 (순수 TypeScript)
 */

export const TODAY = '2026-05-27'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MentoringStatus = 'active' | 'completed' | 'suspended' | 'deleted'
export type UploadStatus    = 'enabled' | 'blocked'

export interface ActivityEntry {
  id:           string
  activityDate: string   // YYYY-MM-DD
  content:      string
  memo:         string
  photoName:    string
  photoUrl:     string
  hasCost:      boolean  // 비용 사용 여부
  receiptName:  string
  receiptUrl:   string
}

export interface MonthData {
  monthIndex: 1 | 2 | 3
  activities: ActivityEntry[]  // 최대 5개
}

export interface MentoringGoals {
  expectations: [string, string, string]  // 기대사항(멘티) 3줄
  cooperation:  [string, string, string]  // 협력사항(멘토) 3줄
  savedAt:      string | null
}

export interface MentoringRecord {
  id:                 string
  mentorName:         string
  mentorEmail:        string   // 필수
  menteeName:         string
  joinMonth:          string   // YYYY-MM (입사월)
  startDate:          string   // joinMonth 첫째 날 (자동 계산)
  endDate:            string   // joinMonth+2 마지막 날 (자동 계산)
  status:             MentoringStatus
  uploadStatus:       UploadStatus
  uploadBlockReason:  string
  note:               string
  token:              string
  months:             MonthData[]    // 항상 [1개월차, 2개월차, 3개월차]
  goals:              MentoringGoals
  initialMailSent:    boolean
  initialMailSentAt:  string | null
  endMailSent:        boolean
  endMailSentAt:      string | null
  linkCopied:         boolean
  lastAccessAt:       string | null
  createdAt:          string
  deletedAt:          string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 날짜 계산
// ─────────────────────────────────────────────────────────────────────────────

/** 입사월(YYYY-MM)로부터 startDate / endDate 자동 계산 (3개월) */
export function calcDatesFromJoinMonth(joinMonth: string): { startDate: string; endDate: string } {
  const [y, m] = joinMonth.split('-').map(Number)
  const startDate     = `${joinMonth}-01`
  const endTotalMonth = m + 2
  const endY          = y + (endTotalMonth > 12 ? 1 : 0)
  const endM          = endTotalMonth > 12 ? endTotalMonth - 12 : endTotalMonth
  const lastDay       = new Date(endY, endM, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { startDate, endDate: `${endY}-${pad(endM)}-${lastDay}` }
}

/** startDate + monthIndex → 해당 달의 시작·종료일 */
export function getMonthPeriod(startDate: string, monthIndex: number): { start: string; end: string } {
  const [year, month] = startDate.split('-').map(Number)
  const total = month + monthIndex - 1
  const y     = year + Math.floor((total - 1) / 12)
  const m     = ((total - 1) % 12) + 1
  const pad   = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m)}-01`,
    end:   `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}`,
  }
}

/** 해당 monthIndex의 YYYY-MM 반환 */
export function getMonthYM(startDate: string, monthIndex: number): string {
  return getMonthPeriod(startDate, monthIndex).start.slice(0, 7)
}

/** TODAY 기준 현재 몇 개월차인지 (0=대기, 1~3=진행, 4=종료) */
export function getCurrentMonthIndex(record: MentoringRecord): 0 | 1 | 2 | 3 | 4 {
  for (let i = 1; i <= 3; i++) {
    const { start, end } = getMonthPeriod(record.startDate, i)
    if (TODAY >= start && TODAY <= end) return i as 1 | 2 | 3
  }
  if (TODAY > getMonthPeriod(record.startDate, 3).end) return 4
  return 0
}

/** 특정 캘린더 월(YYYY-MM)에 해당하는 MonthData 반환 */
export function getMonthDataForYM(record: MentoringRecord, ym: string): MonthData | null {
  for (const m of record.months) {
    if (getMonthYM(record.startDate, m.monthIndex) === ym) return m
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// 활동 인정 기준 (수정됨)
// ─────────────────────────────────────────────────────────────────────────────
//
//  사진 있음 + 비용 없음          → 인정
//  사진 있음 + 비용 있음 + 영수증  → 인정
//  사진 있음 + 비용 있음 + 영수증X → 미인정
//  사진 없음                      → 미인정
//
// ─────────────────────────────────────────────────────────────────────────────

/** 유효 활동 수 */
export function countValidActivities(monthData: MonthData): number {
  return monthData.activities.filter(a => {
    if (!a.photoName) return false
    if (!a.hasCost)   return true
    return !!a.receiptName
  }).length
}

/** 전체 등록 활동 수 (유효 여부 무관) */
export function countAllActivities(monthData: MonthData): number {
  return monthData.activities.length
}

/** 월별 지급액 (유효 활동 기준) */
export function getMonthlyPayment(monthData: MonthData): number {
  const n = countValidActivities(monthData)
  if (n >= 3) return 100_000
  if (n === 2) return  50_000
  return 0
}

/** 전체 예상 지급액 (3개월 합산) */
export function getTotalExpectedPayment(record: MentoringRecord): number {
  return record.months.reduce((s, m) => s + getMonthlyPayment(m), 0)
}

/** 금액 포맷 */
export function fmtAmount(n: number): string {
  return n === 0 ? '0원' : `${n.toLocaleString()}원`
}

// ─────────────────────────────────────────────────────────────────────────────
// 레코드 생성 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

export function createEmptyMonths(): MonthData[] {
  return ([1, 2, 3] as const).map(monthIndex => ({
    monthIndex,
    activities: [],
  }))
}

export function createEmptyGoals(): MentoringGoals {
  return {
    expectations: ['', '', ''],
    cooperation:  ['', '', ''],
    savedAt:      null,
  }
}

export function generateToken(): string {
  return 'mentor_' + Math.random().toString(36).slice(2, 9)
}

// ─────────────────────────────────────────────────────────────────────────────
// 메일 바디 생성
// ─────────────────────────────────────────────────────────────────────────────

export function generateInitialGuideMailBody(record: MentoringRecord, link: string): string {
  const p1 = getMonthPeriod(record.startDate, 1)
  const p3 = getMonthPeriod(record.startDate, 3)
  return `안녕하세요.

인재협업팀 안소정입니다.

${record.mentorName}님께서는 신규입사자 ${record.menteeName}님의 멘토로 선정되셨습니다.
멘토링 진행 부탁드리며, 아래 내용 확인 후 활동 부탁드립니다.

■ 멘토링 기간
${p1.start} ~ ${p3.end} (총 3개월)

■ 멘토 대시보드 링크
${link}

활동 사진 및 증빙은 멘토링 대시보드에 업로드해 주세요.

■ 활동 등록 방법
1. 위 링크로 접속합니다.
2. 해당 월 카드에서 [활동 추가] 버튼을 클릭합니다.
3. 활동일, 활동 내용, 활동 사진을 등록합니다.
4. 비용이 발생한 경우 '비용 사용 있음'을 체크하고 영수증을 업로드합니다.
5. 저장 버튼을 클릭합니다.

■ 월별 지급 기준 (매월 독립 정산)
- 0~1회 인정: 0원
- 2회 인정: 50,000원
- 3회 이상 인정: 100,000원 (월 최대)

※ 멘토링 활동은 활동 사진 등록 시 인정됩니다.
   비용 사용이 없는 활동도 인정 가능합니다.
   단, 비용 사용이 있는 경우에는 영수증 업로드가 필요합니다.
※ 총 최대 지급 금액: 300,000원 (3개월 합산)

감사합니다.`
}

export function generateEndMailBody(record: MentoringRecord): string {
  const lines = record.months.map(m => {
    const n   = countValidActivities(m)
    const amt = getMonthlyPayment(m)
    const { start, end } = getMonthPeriod(record.startDate, m.monthIndex)
    return `  ${m.monthIndex}개월차 (${start} ~ ${end}): ${n}회 인정 → ${fmtAmount(amt)}`
  })
  return `안녕하세요.

인재협업팀 안소정입니다.

${record.mentorName}님, ${record.menteeName}님 멘토링이 종료되었습니다.
활동 내역 및 지급 예정 금액을 안내드립니다.

■ 월별 활동 내역

${lines.join('\n')}

■ 지급 예정 총액: ${fmtAmount(getTotalExpectedPayment(record))}

활동 기준 지급 예정 금액을 초과하여 사용하신 경우 초과 사용 금액은 지급되지 않습니다.

■ 활동 등록 마감 안내

멘토링 활동 등록은 매월 1일 14:00까지 완료 부탁드립니다.
1일이 공휴일 또는 빨간날인 경우 다음 영업일 14:00까지 등록 부탁드립니다.

■ 활동비 지급 일정

멘토링 활동비는 사용월 기준 익월 10일 지급 예정입니다.
예: 5월 활동비는 6월 10일 지급
단, 공휴일 또는 휴무일이 포함된 경우 지급일은 전후로 변동될 수 있습니다.

감사합니다.`
}

// ─────────────────────────────────────────────────────────────────────────────
// 메일 발송 API 스텁
// ─────────────────────────────────────────────────────────────────────────────

export async function sendInitialGuideMail(record: MentoringRecord): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link   = `${origin}/mentor/${record.token}`
  const text   = generateInitialGuideMailBody(record, link)
  await fetch('/api/send-mail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ to: record.mentorEmail, subject: '신규입사자 멘토링 안내', text }),
  }).catch(err => console.warn('[sendInitialGuideMail]', err))
}

export async function sendEndMail(record: MentoringRecord): Promise<void> {
  const text = generateEndMailBody(record)
  await fetch('/api/send-mail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ to: record.mentorEmail, subject: '멘토링 종료 안내', text }),
  }).catch(err => console.warn('[sendEndMail]', err))
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock 데이터
// ─────────────────────────────────────────────────────────────────────────────

export const INITIAL_DATA: MentoringRecord[] = [
  // ── 1: 2026-05 입사, 진행중, 활동 없음, 목표 미작성
  {
    id: '1',
    mentorName: '김멘토', mentorEmail: 'kim.mentor@hecto.co.kr',
    menteeName: '이멘티',
    joinMonth: '2026-05', startDate: '2026-05-01', endDate: '2026-07-31',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_a1b2c3',
    months: [
      { monthIndex: 1, activities: [] },
      { monthIndex: 2, activities: [] },
      { monthIndex: 3, activities: [] },
    ],
    goals: { expectations: ['', '', ''], cooperation: ['', '', ''], savedAt: null },
    initialMailSent: false, initialMailSentAt: null,
    endMailSent: false, endMailSentAt: null,
    linkCopied: false, lastAccessAt: null,
    createdAt: '2026-05-01', deletedAt: null,
  },

  // ── 2: 2026-04 입사, 1개월차 활동 3회, 2개월차 진행중, 목표 작성 완료
  {
    id: '2',
    mentorName: '박멘토', mentorEmail: 'park.mentor@hecto.co.kr',
    menteeName: '최멘티',
    joinMonth: '2026-04', startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_b4e5f6',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'a1', activityDate: '2026-04-05', content: '첫 만남 및 멘토링 계획 수립', memo: '',
            photoName: 'photo_01.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
          { id: 'a2', activityDate: '2026-04-15', content: '업무 적응 현황 공유 및 상담', memo: '',
            photoName: 'photo_02.jpg', photoUrl: '', hasCost: true, receiptName: 'receipt_02.jpg', receiptUrl: '' },
          { id: 'a3', activityDate: '2026-04-25', content: '조직 문화 이해도 점검', memo: '',
            photoName: 'photo_03.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'a4', activityDate: '2026-05-08', content: '2개월차 목표 설정 미팅', memo: '',
            photoName: 'photo_04.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
          // hasCost=true 이지만 영수증 없음 → 미인정 케이스
          { id: 'a5', activityDate: '2026-05-19', content: '실무 역량 강화 미팅', memo: '카페 미팅',
            photoName: 'photo_05.jpg', photoUrl: '', hasCost: true, receiptName: '', receiptUrl: '' },
        ],
      },
      { monthIndex: 3, activities: [] },
    ],
    goals: {
      expectations: ['업무 역할에 빠르게 적응하고 싶습니다.', '팀 문화를 이해하고 싶습니다.', '성장을 위한 피드백을 받고 싶습니다.'],
      cooperation:  ['정기적인 미팅을 통해 적극 지원하겠습니다.', '업무 노하우를 공유하겠습니다.', '고민을 함께 해결해 나가겠습니다.'],
      savedAt: '2026-04-02',
    },
    initialMailSent: true, initialMailSentAt: '2026-04-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-05-20',
    createdAt: '2026-04-01', deletedAt: null,
  },

  // ── 3: 2026-03 입사, 1·2개월차 완료, 3개월차 진행중
  {
    id: '3',
    mentorName: '정멘토', mentorEmail: 'jung.mentor@hecto.co.kr',
    menteeName: '한멘티',
    joinMonth: '2026-03', startDate: '2026-03-01', endDate: '2026-05-31',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_c7d8e9',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'b1', activityDate: '2026-03-05', content: '첫 만남', memo: '',
            photoName: 'p_b1.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
          { id: 'b2', activityDate: '2026-03-14', content: '업무 적응', memo: '',
            photoName: 'p_b2.jpg', photoUrl: '', hasCost: true, receiptName: 'r_b2.pdf', receiptUrl: '' },
          { id: 'b3', activityDate: '2026-03-24', content: '조직 문화', memo: '',
            photoName: 'p_b3.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'b4', activityDate: '2026-04-07', content: '목표 설정', memo: '',
            photoName: 'p_b4.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
          { id: 'b5', activityDate: '2026-04-16', content: '실무 역량 강화', memo: '',
            photoName: 'p_b5.jpg', photoUrl: '', hasCost: true, receiptName: 'r_b5.pdf', receiptUrl: '' },
          { id: 'b6', activityDate: '2026-04-25', content: '중간 점검', memo: '',
            photoName: 'p_b6.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 3,
        activities: [
          { id: 'b7', activityDate: '2026-05-08', content: '3개월차 마무리', memo: '',
            photoName: 'p_b7.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
        ],
      },
    ],
    goals: {
      expectations: ['실무 역량을 키우고 싶습니다.', '사내 네트워크를 넓히고 싶습니다.', ''],
      cooperation:  ['주 1회 정기 미팅을 진행하겠습니다.', '필요 시 수시 연락 가능합니다.', ''],
      savedAt: '2026-03-02',
    },
    initialMailSent: true, initialMailSentAt: '2026-03-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-05-22',
    createdAt: '2026-03-01', deletedAt: null,
  },

  // ── 4: 2026-04 입사, 멘티 퇴사로 업로드 차단/중단
  {
    id: '4',
    mentorName: '오멘토', mentorEmail: 'oh.mentor@hecto.co.kr',
    menteeName: '강멘티',
    joinMonth: '2026-04', startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'suspended', uploadStatus: 'blocked', uploadBlockReason: '멘티 퇴사',
    note: '5월 초 멘티 퇴사로 멘토링 중단',
    token: 'mentor_d2f3g4',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'c1', activityDate: '2026-04-10', content: '초기 미팅', memo: '',
            photoName: 'p_c1.jpg', photoUrl: '', hasCost: false, receiptName: '', receiptUrl: '' },
          { id: 'c2', activityDate: '2026-04-22', content: '업무 환경 안내', memo: '',
            photoName: 'p_c2.jpg', photoUrl: '', hasCost: true, receiptName: 'r_c2.pdf', receiptUrl: '' },
        ],
      },
      { monthIndex: 2, activities: [] },
      { monthIndex: 3, activities: [] },
    ],
    goals: { expectations: ['', '', ''], cooperation: ['', '', ''], savedAt: null },
    initialMailSent: true, initialMailSentAt: '2026-04-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-04-22',
    createdAt: '2026-04-01', deletedAt: null,
  },
]
