/**
 * lib/mentoring.ts — mentoring-dashboard 전용
 * Supabase 연결 전 mock/local 상태로 운영
 * React 의존성 없음 (순수 TypeScript)
 */

export const TODAY = '2026-05-27'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MentoringStatus   = 'active' | 'completed' | 'suspended' | 'deleted'
export type UploadStatus      = 'enabled' | 'blocked'
export type ApprovalStatus    = 'pending' | 'approved' | 'rejected'
export type PaymentStatus     = 'pending' | 'paid' | 'not_paid'

export interface ActivityEntry {
  id: string
  activityDate: string  // YYYY-MM-DD
  content: string
  memo: string
  photoName: string
  photoUrl: string
  receiptName: string
  receiptUrl: string
}

export interface MonthData {
  monthIndex: 1 | 2 | 3
  activities: ActivityEntry[]
  approvalStatus: ApprovalStatus
  paymentStatus: PaymentStatus
  approvedAt: string | null
}

export interface MentoringRecord {
  id: string
  mentorName: string
  mentorEmail: string     // 필수
  menteeName: string
  menteeEmail: string
  startDate: string       // YYYY-MM-DD
  endDate: string         // YYYY-MM-DD (종료 예정일)
  status: MentoringStatus
  uploadStatus: UploadStatus
  uploadBlockReason: string
  note: string
  token: string
  months: MonthData[]     // 항상 [1개월차, 2개월차, 3개월차]
  initialMailSent: boolean
  initialMailSentAt: string | null
  endMailSent: boolean
  endMailSentAt: string | null
  linkCopied: boolean
  lastAccessAt: string | null
  createdAt: string
  deletedAt: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// 기간 계산
// ─────────────────────────────────────────────────────────────────────────────

/** startDate + monthIndex 로 해당 달의 시작/종료일 반환 */
export function getMonthPeriod(startDate: string, monthIndex: number): { start: string; end: string } {
  const [year, month] = startDate.split('-').map(Number)
  const total = month + monthIndex - 1
  const y = year + Math.floor((total - 1) / 12)
  const m = ((total - 1) % 12) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
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
// 지급액 계산
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 유효 활동 수: 사진 + 영수증 모두 있는 건만 인정
 */
export function countValidActivities(monthData: MonthData): number {
  return monthData.activities.filter(a => !!a.photoName && !!a.receiptName).length
}

/** 총 등록 활동 수 */
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

/** 실제 지급 완료 금액 */
export function getPaidAmount(record: MentoringRecord): number {
  return record.months
    .filter(m => m.paymentStatus === 'paid')
    .reduce((s, m) => s + getMonthlyPayment(m), 0)
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
    approvalStatus: 'pending' as ApprovalStatus,
    paymentStatus:  'pending' as PaymentStatus,
    approvedAt: null,
  }))
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

활동 사진 및 영수증은 멘토링 대시보드에 업로드해 주세요.

■ 활동 등록 방법
1. 위 링크로 접속합니다.
2. 해당 월 카드에서 [활동 추가] 버튼을 클릭합니다.
3. 활동일, 활동 내용, 활동 사진, 영수증을 등록합니다.
4. 저장 버튼을 클릭합니다.

■ 월별 지급 기준 (매월 독립 정산)
- 0~1회 등록: 0원
- 2회 등록: 50,000원
- 3회 이상 등록: 100,000원 (월 최대)

※ 활동 사진과 영수증이 함께 등록된 건을 1회로 인정합니다.
※ 총 최대 지급 금액: 300,000원 (3개월 합산)

감사합니다.`
}

export function generateEndMailBody(record: MentoringRecord): string {
  const lines = record.months.map(m => {
    const n   = countValidActivities(m)
    const amt = getMonthlyPayment(m)
    const { start, end } = getMonthPeriod(record.startDate, m.monthIndex)
    return `  ${m.monthIndex}개월차 (${start} ~ ${end}): ${n}회 → ${fmtAmount(amt)}`
  })
  return `안녕하세요.

인재협업팀 안소정입니다.

${record.mentorName}님, ${record.menteeName}님 멘토링이 종료되었습니다.
활동 내역 및 지급 예정 금액을 안내드립니다.

■ 월별 활동 내역

${lines.join('\n')}

■ 지급 예정 총액: ${fmtAmount(getTotalExpectedPayment(record))}

활동 기준 지급 예정 금액을 초과하여 사용하신 경우 초과 사용 금액은 지급되지 않습니다.

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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: record.mentorEmail, subject: '신규입사자 멘토링 안내', text }),
  }).catch(err => console.warn('[sendInitialGuideMail]', err))
}

export async function sendEndMail(record: MentoringRecord): Promise<void> {
  const text = generateEndMailBody(record)
  await fetch('/api/send-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: record.mentorEmail, subject: '멘토링 종료 안내', text }),
  }).catch(err => console.warn('[sendEndMail]', err))
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock 데이터
// ─────────────────────────────────────────────────────────────────────────────

export const INITIAL_DATA: MentoringRecord[] = [
  // ── 1: 2026-05 시작, 진행중, 활동 없음
  {
    id: '1',
    mentorName: '김멘토', mentorEmail: 'kim.mentor@hecto.co.kr',
    menteeName: '이멘티', menteeEmail: 'lee.mentee@hecto.co.kr',
    startDate: '2026-05-01', endDate: '2026-07-31',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_a1b2c3',
    months: [
      { monthIndex: 1, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
      { monthIndex: 2, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
      { monthIndex: 3, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
    ],
    initialMailSent: false, initialMailSentAt: null,
    endMailSent: false, endMailSentAt: null,
    linkCopied: false, lastAccessAt: null,
    createdAt: '2026-05-01', deletedAt: null,
  },
  // ── 2: 2026-04 시작, 1개월차 승인/지급, 2개월차 진행중
  {
    id: '2',
    mentorName: '박멘토', mentorEmail: 'park.mentor@hecto.co.kr',
    menteeName: '최멘티', menteeEmail: 'choi.mentee@hecto.co.kr',
    startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_b4e5f6',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'a1', activityDate: '2026-04-05', content: '첫 만남 및 멘토링 계획 수립', memo: '', photoName: 'photo_01.jpg', photoUrl: '', receiptName: 'receipt_01.jpg', receiptUrl: '' },
          { id: 'a2', activityDate: '2026-04-15', content: '업무 적응 현황 공유 및 상담', memo: '', photoName: 'photo_02.jpg', photoUrl: '', receiptName: 'receipt_02.jpg', receiptUrl: '' },
          { id: 'a3', activityDate: '2026-04-25', content: '조직 문화 이해도 점검', memo: '', photoName: 'photo_03.jpg', photoUrl: '', receiptName: 'receipt_03.jpg', receiptUrl: '' },
        ],
        approvalStatus: 'approved', paymentStatus: 'paid', approvedAt: '2026-05-03',
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'a4', activityDate: '2026-05-08', content: '2개월차 목표 설정 미팅', memo: '', photoName: 'photo_04.jpg', photoUrl: '', receiptName: 'receipt_04.jpg', receiptUrl: '' },
          { id: 'a5', activityDate: '2026-05-19', content: '실무 역량 강화 미팅', memo: '카페 미팅', photoName: 'photo_05.jpg', photoUrl: '', receiptName: '', receiptUrl: '' },
        ],
        approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null,
      },
      { monthIndex: 3, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
    ],
    initialMailSent: true, initialMailSentAt: '2026-04-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-05-20',
    createdAt: '2026-04-01', deletedAt: null,
  },
  // ── 3: 2026-03 시작, 3개월차 진행중 (1·2개월차 승인 완료)
  {
    id: '3',
    mentorName: '정멘토', mentorEmail: 'jung.mentor@hecto.co.kr',
    menteeName: '한멘티', menteeEmail: 'han.mentee@hecto.co.kr',
    startDate: '2026-03-01', endDate: '2026-05-31',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_c7d8e9',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'b1', activityDate: '2026-03-05', content: '첫 만남', memo: '', photoName: 'p_b1.jpg', photoUrl: '', receiptName: 'r_b1.pdf', receiptUrl: '' },
          { id: 'b2', activityDate: '2026-03-14', content: '업무 적응', memo: '', photoName: 'p_b2.jpg', photoUrl: '', receiptName: 'r_b2.pdf', receiptUrl: '' },
          { id: 'b3', activityDate: '2026-03-24', content: '조직 문화 적응', memo: '', photoName: 'p_b3.jpg', photoUrl: '', receiptName: 'r_b3.pdf', receiptUrl: '' },
        ],
        approvalStatus: 'approved', paymentStatus: 'paid', approvedAt: '2026-04-02',
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'b4', activityDate: '2026-04-07', content: '목표 설정 미팅', memo: '', photoName: 'p_b4.jpg', photoUrl: '', receiptName: 'r_b4.pdf', receiptUrl: '' },
          { id: 'b5', activityDate: '2026-04-16', content: '실무 역량 강화', memo: '', photoName: 'p_b5.jpg', photoUrl: '', receiptName: 'r_b5.pdf', receiptUrl: '' },
          { id: 'b6', activityDate: '2026-04-25', content: '중간 점검 및 피드백', memo: '', photoName: 'p_b6.jpg', photoUrl: '', receiptName: 'r_b6.pdf', receiptUrl: '' },
        ],
        approvalStatus: 'approved', paymentStatus: 'paid', approvedAt: '2026-05-02',
      },
      {
        monthIndex: 3,
        activities: [
          { id: 'b7', activityDate: '2026-05-08', content: '3개월차 마무리 미팅', memo: '', photoName: 'p_b7.jpg', photoUrl: '', receiptName: 'r_b7.pdf', receiptUrl: '' },
        ],
        approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null,
      },
    ],
    initialMailSent: true, initialMailSentAt: '2026-03-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-05-22',
    createdAt: '2026-03-01', deletedAt: null,
  },
  // ── 4: 2026-04 시작, 멘티 퇴사로 업로드 차단/중단
  {
    id: '4',
    mentorName: '오멘토', mentorEmail: 'oh.mentor@hecto.co.kr',
    menteeName: '강멘티', menteeEmail: 'kang.mentee@hecto.co.kr',
    startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'suspended', uploadStatus: 'blocked', uploadBlockReason: '멘티 퇴사',
    note: '5월 초 멘티 퇴사로 멘토링 중단',
    token: 'mentor_d2f3g4',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'c1', activityDate: '2026-04-10', content: '초기 미팅 및 오리엔테이션', memo: '', photoName: 'p_c1.jpg', photoUrl: '', receiptName: 'r_c1.pdf', receiptUrl: '' },
          { id: 'c2', activityDate: '2026-04-22', content: '업무 환경 안내', memo: '', photoName: 'p_c2.jpg', photoUrl: '', receiptName: 'r_c2.pdf', receiptUrl: '' },
        ],
        approvalStatus: 'approved', paymentStatus: 'paid', approvedAt: '2026-05-04',
      },
      { monthIndex: 2, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
      { monthIndex: 3, activities: [], approvalStatus: 'pending', paymentStatus: 'pending', approvedAt: null },
    ],
    initialMailSent: true, initialMailSentAt: '2026-04-01',
    endMailSent: false, endMailSentAt: null,
    linkCopied: true, lastAccessAt: '2026-04-22',
    createdAt: '2026-04-01', deletedAt: null,
  },
]
