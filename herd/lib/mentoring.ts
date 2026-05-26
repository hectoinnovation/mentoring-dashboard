/**
 * lib/mentoring.ts
 * Shared types, dummy data, and calculation functions.
 * No React dependencies — pure TypeScript.
 */

export const TODAY = '2026-05-22'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Activity {
  round: number       // 1–9
  monthIndex: number  // 1, 2, or 3
  date: string
  content: string
  photoName: string
  photoUrl: string    // Supabase Storage URL or blob URL
  receiptName: string // 영수증 파일명
  receiptUrl: string  // Supabase Storage URL
  saved: boolean
  proposalChecked: boolean
}

export interface MentoringRecord {
  id: string
  mentorName: string
  menteeName: string
  mentorEmail: string
  joinMonth: string  // 'YYYY-MM'
  token: string
  expectation: string
  cooperation: string
  activities: Activity[]
  initialGuideMailStatus: 'pending' | 'sent'
  monthlyProposalMailStatus: 'pending' | 'sent'
  proposalSubmitted: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy Data
// ─────────────────────────────────────────────────────────────────────────────

function buildActivities(savedCount: number, joinMonth: string): Activity[] {
  const [y, m] = joinMonth.split('-').map(Number)
  const m2 = m === 12 ? 1 : m + 1;  const y2 = m === 12 ? y + 1 : y
  const m3 = m2 === 12 ? 1 : m2 + 1; const y3 = m2 === 12 ? y2 + 1 : y2
  const p = (n: number) => String(n).padStart(2, '0')
  const dates = [
    `${joinMonth}-05`, `${joinMonth}-12`, `${joinMonth}-20`,
    `${y2}-${p(m2)}-08`, `${y2}-${p(m2)}-16`, `${y2}-${p(m2)}-24`,
    `${y3}-${p(m3)}-06`, `${y3}-${p(m3)}-14`, `${y3}-${p(m3)}-22`,
  ]
  const contents = [
    '첫 만남 및 멘토링 계획 수립', '업무 적응 현황 공유 및 상담', '조직 문화 이해도 점검',
    '2개월차 목표 설정 미팅', '실무 역량 강화 미팅', '중간 점검 및 피드백',
    '3개월차 성과 공유', '마무리 미팅 및 향후 계획', '최종 평가 및 종료 면담',
  ]
  const photos = [
    'activity_01.jpg', 'meeting_02.jpg', 'lunch_03.jpg',
    'cafe_04.jpg', 'office_05.jpg', 'video_call_06.jpg',
    'walk_07.jpg', 'dinner_08.jpg', '',
  ]
  return Array.from({ length: 9 }, (_, i) => ({
    round: i + 1,
    monthIndex: i < 3 ? 1 : i < 6 ? 2 : 3,
    date:        i < savedCount ? dates[i]    : '',
    content:     i < savedCount ? contents[i] : '',
    photoName:   i < savedCount ? photos[i]   : '',
    photoUrl:    '',
    receiptName: '',
    receiptUrl:  '',
    saved:           i < savedCount,
    proposalChecked: false,
  }))
}

/** 신규 멘토링 생성 시 사용 — 9회차 모두 미저장 상태 */
export function createEmptyActivities(joinMonth: string): Activity[] {
  return buildActivities(0, joinMonth)
}

export const INITIAL_DATA: MentoringRecord[] = [
  {
    id: '1', mentorName: '김멘토', menteeName: '이멘티',
    mentorEmail: 'kim.mentor@hecto.co.kr', joinMonth: '2026-05',
    token: 'mentor_a1', expectation: '', cooperation: '',
    activities: buildActivities(0, '2026-05'),
    initialGuideMailStatus: 'pending', monthlyProposalMailStatus: 'pending', proposalSubmitted: false,
  },
  {
    id: '2', mentorName: '박멘토', menteeName: '최멘티',
    mentorEmail: 'park.mentor@hecto.co.kr', joinMonth: '2026-04',
    token: 'mentor_b2',
    expectation: '조직 문화를 빠르게 이해하고 싶습니다.',
    cooperation: '매주 1회 정기 미팅을 진행하겠습니다.',
    activities: buildActivities(2, '2026-04'),
    initialGuideMailStatus: 'sent', monthlyProposalMailStatus: 'pending', proposalSubmitted: false,
  },
  {
    id: '3', mentorName: '정멘토', menteeName: '한멘티',
    mentorEmail: 'jung.mentor@hecto.co.kr', joinMonth: '2026-03',
    token: 'mentor_d4',
    expectation: '업무 역량을 빠르게 키우고 싶습니다.',
    cooperation: '실무 경험과 노하우를 적극 공유하겠습니다.',
    activities: buildActivities(4, '2026-03'),
    initialGuideMailStatus: 'sent', monthlyProposalMailStatus: 'sent', proposalSubmitted: false,
  },
  {
    id: '4', mentorName: '오멘토', menteeName: '강멘티',
    mentorEmail: 'oh.mentor@hecto.co.kr', joinMonth: '2026-02',
    token: 'mentor_c3',
    expectation: '회사 내 네트워크를 형성하고 싶습니다.',
    cooperation: '다양한 부서 동료들과 연결해 드리겠습니다.',
    activities: buildActivities(7, '2026-02'),
    initialGuideMailStatus: 'sent', monthlyProposalMailStatus: 'sent', proposalSubmitted: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Calculation Functions
// ─────────────────────────────────────────────────────────────────────────────

export function getMonthRange(
  joinMonth: string,
  monthIndex: number,
): { start: string; end: string } {
  const [year, month] = joinMonth.split('-').map(Number)
  const total = month + monthIndex - 1
  const y = year + Math.floor((total - 1) / 12)
  const m = ((total - 1) % 12) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${y}-${pad(m)}-01`,
    end:   `${y}-${pad(m)}-${new Date(y, m, 0).getDate()}`,
  }
}

export function getMonthStartDate(joinMonth: string, monthIndex: number): string {
  return getMonthRange(joinMonth, monthIndex).start
}

export function getMonthEndDate(joinMonth: string, monthIndex: number): string {
  return getMonthRange(joinMonth, monthIndex).end
}

export function getEndMonth(joinMonth: string): string {
  const [y, m] = joinMonth.split('-').map(Number)
  const total = m + 2
  const ey = y + Math.floor((total - 1) / 12)
  const em = ((total - 1) % 12) + 1
  return `${ey}-${String(em).padStart(2, '0')}`
}

export function getMentoringPeriod(joinMonth: string): { start: string; end: string } {
  return { start: joinMonth, end: getEndMonth(joinMonth) }
}

export function getIsFinished(joinMonth: string): boolean {
  return TODAY > getMonthRange(joinMonth, 3).end
}

export function getTotalActivities(r: MentoringRecord): number {
  return r.activities.filter(a => a.saved).length
}

export function getMonthActivities(r: MentoringRecord, monthIndex: number): number {
  return r.activities.filter(a => a.saved && a.monthIndex === monthIndex).length
}

export function getRemainingToThree(r: MentoringRecord): number {
  return Math.max(0, 3 - getTotalActivities(r))
}

/** 월별 독립 계산 — 0~1회: 0원 / 2회: 50,000원 / 3회 이상: 100,000원 */
export function getMonthlySupportAmount(r: MentoringRecord, mi: number): number {
  const count = getMonthActivities(r, mi)
  if (count >= 3) return 100000
  if (count === 2) return 50000
  return 0
}

export function getTotalSupportAmount(r: MentoringRecord): number {
  return getMonthlySupportAmount(r, 1) + getMonthlySupportAmount(r, 2) + getMonthlySupportAmount(r, 3)
}

export function getCurrentMonthIndex(joinMonth: string): number {
  for (let i = 1; i <= 3; i++) {
    const { start, end } = getMonthRange(joinMonth, i)
    if (TODAY >= start && TODAY <= end) return i
  }
  return TODAY > getMonthRange(joinMonth, 3).end ? 4 : 0
}

export function getMonthStatus(r: MentoringRecord, mi: number): string {
  const { start, end } = getMonthRange(r.joinMonth, mi)
  const count = getMonthActivities(r, mi)
  if (TODAY < start) return '대기'
  if (TODAY <= end) return count >= 3 ? '마감' : '진행중'
  if (count >= 3) return '마감'
  if (count >= 1) return '미달 마감'
  return '미진행 마감'
}

export function getOperationStatus(r: MentoringRecord): string {
  const idx = getCurrentMonthIndex(r.joinMonth)
  if (idx === 0) return '대기'
  if (idx >= 1 && idx <= 3) return '운영 중'
  return '전체 종료'
}

export function hasPhotoUploaded(r: MentoringRecord): boolean {
  return r.activities.some(a => a.saved && !!a.photoName)
}

export function hasReceiptUploaded(r: MentoringRecord, mi?: number): boolean {
  return r.activities.some(a =>
    a.saved && !!a.receiptName && (mi == null || a.monthIndex === mi)
  )
}

export function getInitialGuideStatus(r: MentoringRecord): 'pending' | 'sent' {
  return r.initialGuideMailStatus
}

export function getMonthlyProposalGuideStatus(r: MentoringRecord): 'pending' | 'sent' {
  return r.monthlyProposalMailStatus
}

export function getProposalSubmitStatus(r: MentoringRecord): boolean {
  return r.proposalSubmitted
}

export function fmtAmount(n: number): string {
  return n === 0 ? '0원' : `${n.toLocaleString()}원`
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail Body Generators
// ─────────────────────────────────────────────────────────────────────────────

export function generateInitialGuideMailBody(record: MentoringRecord, link: string): string {
  return `안녕하세요.

인재협업팀 안소정입니다.

${record.mentorName}님께서는 신규입사자 ${record.menteeName}님 (${record.joinMonth} 입사)의 멘토로 선정되셨습니다.

신규입사자의 안정적인 회사생활과 조직 적응을 위해 멘토링 진행 부탁드리며, 아래 내용 확인 후 활동 부탁드립니다.

※ 멘토링 활동 등록 링크
${link}

멘토링은 입사월 기준 총 3개월 동안 운영됩니다.

멘토링 활동은 신규입사자의 조직 적응 및 회사 이해도 향상을 위해 월별 최소 3회 진행을 권장드립니다.

■ 지원금 월별 정산 방식

지원금은 월별 독립 정산 방식으로 운영됩니다.
(전체 활동 누적 기준 아님)

월별 지급 기준
- 0~1회: 0원
- 2회: 50,000원
- 3회 이상: 100,000원

※ 월 최대 지급: 100,000원
※ 총 최대 지급: 300,000원

활동 내용 및 활동 사진은 멘토링 링크에 등록 부탁드립니다.

품의 및 영수증 증빙은 기존과 동일하게 내부망 → "멘토링 활동/정산 신청서" 검색 후 등록 부탁드립니다.

--------------------------------------------------

[멘토의 역할]

1) 신규입사자 입사 당일 에스코트
(OJT / 근로계약서 작성 후 인사팀 개별 연락 예정)

2) 입사일 PC 설명 및 세팅 안내
(네이버웍스, NAC, FTC, 클라우디움, 복호화 등)

초기 비밀번호:
hecto12!@

※ 업무망 / 인터넷망 비밀번호는 각각 설정 필요
※ 클라우디움 비밀번호 = 아이디 / 패스워드 동일

3) 복지포인트(뚜벅 정산서) 신청 작성 안내

4) 멘티와 교류가 필요한 인원을 선정하고 멘토링 활동 진행

5) 조직 목표, 방침, 기능, 커뮤니케이션 채널, 육성 프로그램 및 회사 내·외부 자원 정보 공유

6) 기타 멘티 업무 수행에 필요한 제반 지원

감사합니다.`
}

export function generateProposalMailBody(record: MentoringRecord): string {
  const curIdx    = getCurrentMonthIndex(record.joinMonth)
  const targetIdx = (curIdx >= 1 && curIdx <= 3)
    ? curIdx
    : ([3, 2, 1] as const).find(mi => getMonthlySupportAmount(record, mi) > 0) ?? 1
  const settledAmt = getMonthlySupportAmount(record, targetIdx)
  const amt1 = getMonthlySupportAmount(record, 1)
  const amt2 = getMonthlySupportAmount(record, 2)
  const amt3 = getMonthlySupportAmount(record, 3)
  const total = getTotalSupportAmount(record)

  return `안녕하세요.

멘토링 활동 지원금 지급을 위해 내부망 품의 등록이 필요합니다.

정산 대상 지원금:
${fmtAmount(settledAmt)}

[월별 상세]
1개월차:
${fmtAmount(amt1)}

2개월차:
${fmtAmount(amt2)}

3개월차:
${fmtAmount(amt3)}

최종 지급 예정 금액:
${fmtAmount(total)}

내부망 → "멘토링 활동/정산 신청서" 검색 후 품의를 등록해주시고,
활동 영수증은 해당 품의에 첨부 부탁드립니다.

감사합니다.`
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail API Calls
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

export async function sendMonthlyProposalMail(record: MentoringRecord): Promise<void> {
  const text = generateProposalMailBody(record)
  await fetch('/api/send-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: record.mentorEmail, subject: '멘토링 활동 지원금 품의 안내', text }),
  }).catch(err => console.warn('[sendMonthlyProposalMail]', err))
}

export async function sendReceiptNotification(
  record: MentoringRecord,
  monthIndex: number,
  round: number,
  fileName: string,
  supportAmount: number,
): Promise<void> {
  await fetch('/api/notify-receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mentorName: record.mentorName,
      menteeName: record.menteeName,
      monthIndex,
      round,
      fileName,
      supportAmount,
    }),
  }).catch(err => console.warn('[sendReceiptNotification]', err))
}
