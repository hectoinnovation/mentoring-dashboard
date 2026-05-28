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
  costAmount:   number   // 실제 사용 금액 (hasCost=true일 때 필수, >0)
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

export interface ProgressBadge {
  text:  string
  color: string  // Tailwind bg+text classes
}

export interface MentoringRecord {
  id:                 string
  mentorName:         string
  mentorEmail:        string   // 필수
  menteeName:         string
  joinDate:           string   // YYYY-MM-DD (입사일, 일 단위)
  joinMonth:          string   // YYYY-MM (입사월, 3개월 기간 계산용)
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

/** 기간을 월 단위로 표시: "2026년 05월 ~ 2026년 07월" */
export function fmtPeriodMonthly(startDate: string, endDate: string): string {
  const sy = startDate.slice(0, 4)
  const sm = startDate.slice(5, 7)
  const ey = endDate.slice(0, 4)
  const em = endDate.slice(5, 7)
  return `${sy}년 ${sm}월 ~ ${ey}년 ${em}월`
}

// ─────────────────────────────────────────────────────────────────────────────
// 활동 인정 기준
//
//  지급인정(countValidActivities):
//    사진 있음 + 비용 없음              → 인정 (사용금액 0)
//    사진 있음 + 비용 있음 + 영수증 + 금액 > 0 → 인정 (사용금액 합계 포함)
//    사진 없음                          → 미인정
//    사진 있음 + 비용 있음 + 영수증 없음  → 미인정
//
//  활동수(countAllActivities):
//    멘토가 등록한 모든 활동 — 사진만 등록 포함
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 지급인정 활동 수
 * - 사진 있음 + 비용 없음 → 1회 인정
 * - 사진 있음 + 비용 있음 + 영수증 + 금액 > 0 → 1회 인정
 * - 사진 없음, 또는 비용 있는데 영수증/금액 미비 → 미인정
 */
export function countValidActivities(monthData: MonthData): number {
  return monthData.activities.filter(a => {
    if (!a.photoName) return false           // 사진 필수
    if (!a.hasCost)   return true            // 사진 + 비용 없음 → 인정
    return !!a.receiptName && a.costAmount > 0  // 비용 있음 → 영수증 + 금액 필수
  }).length
}

/** 전체 등록 활동 수 (유효 여부 무관) */
export function countAllActivities(monthData: MonthData): number {
  return monthData.activities.length
}

/** 실제 사용금액 합계 (유효 활동 중 비용 있는 것만) */
export function getMonthActualCost(monthData: MonthData): number {
  return monthData.activities
    .filter(a => {
      if (!a.photoName || !a.hasCost) return false
      return !!a.receiptName && a.costAmount > 0
    })
    .reduce((sum, a) => sum + a.costAmount, 0)
}

/** 유효 활동 횟수 기준 지급 한도 */
export function getMonthPaymentLimit(monthData: MonthData): number {
  const n = countValidActivities(monthData)
  if (n >= 3) return 100_000
  if (n === 2) return  50_000
  return 0
}

/**
 * 월별 지급금액 = min(유효활동 기준 지급한도, 실제 사용금액 합계)
 * - 비용 없는 활동만 있으면 사용금액=0 → 지급금액=0
 */
export function getMonthlyPayment(monthData: MonthData): number {
  const limit = getMonthPaymentLimit(monthData)
  if (limit === 0) return 0
  return Math.min(limit, getMonthActualCost(monthData))
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
// 진행현황 배지
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 진행현황 배지 — 활동 등록 여부 기준 (지급인정 여부와 무관)
 *
 * "완료" 기준: 해당 월에 활동이 1건 이상 등록된 경우 (사진만 포함)
 * "미제출" 기준: 해당 월이 종료됐는데 활동이 없는 경우
 */
export function getMentoringProgress(record: MentoringRecord): ProgressBadge[] {
  if (record.status === 'suspended')
    return [{ text: '중단', color: 'bg-yellow-100 text-yellow-700' }]

  const ci = getCurrentMonthIndex(record)
  if (ci === 0) return [{ text: '대기', color: 'bg-gray-100 text-gray-500' }]

  // 기간 종료 (ci === 4)
  if (ci === 4) {
    const allComplete = record.months.every(m => countAllActivities(m) > 0)
    if (allComplete) return [{ text: '전체 완료', color: 'bg-blue-100 text-blue-700' }]
    return record.months.map(m =>
      countAllActivities(m) > 0
        ? { text: `${m.monthIndex}차 완료`,      color: 'bg-blue-100 text-blue-700' }
        : { text: `${m.monthIndex}차 미제출 마감`, color: 'bg-red-100 text-red-600' }
    )
  }

  // ci = 1, 2, 3 — 진행 중
  const completedNums: number[] = []
  const unsubBadges: ProgressBadge[] = []

  for (let mi = 1; mi <= 3; mi++) {
    const md = record.months.find(m => m.monthIndex === mi)!
    if (mi < ci) {
      // 지난 달: 활동 등록 여부로 완료 판단
      if (countAllActivities(md) > 0) {
        completedNums.push(mi)
      } else {
        const { end } = getMonthPeriod(record.startDate, mi)
        const [y, mo] = end.split('-').map(Number)
        const nm      = mo === 12 ? 1 : mo + 1
        const ny      = mo === 12 ? y + 1 : y
        const deadline = `${ny}-${String(nm).padStart(2, '0')}-02`
        const overdue  = TODAY >= deadline
        unsubBadges.push({
          text:  `${mi}차 미제출${overdue ? ' 마감' : ''}`,
          color: overdue ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500',
        })
      }
    }
  }

  if (completedNums.length === 3)
    return [{ text: '전체 완료', color: 'bg-blue-100 text-blue-700' }]

  const result: ProgressBadge[] = []
  if (completedNums.length > 0) {
    const label = completedNums.length === 1
      ? `${completedNums[0]}차 완료`
      : completedNums.map(n => String(n)).join('·') + '차 완료'
    result.push({ text: label, color: 'bg-blue-100 text-blue-700' })
  }
  result.push(...unsubBadges)
  // 현재 진행 중인 월은 항상 "N차 진행중" 표시
  result.push({ text: `${ci}차 진행중`, color: 'bg-green-100 text-green-700' })

  return result
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
  return `안녕하세요.

인재협업팀입니다.

${record.mentorName}님께서는 신규입사자 ${record.menteeName}님의 멘토로 선정되셨습니다.
멘토링 진행 부탁드리며, 아래 내용 확인 후 활동 부탁드립니다.

■ 입사일
${record.joinDate}

■ 멘토링 활동 기간
${fmtPeriodMonthly(record.startDate, record.endDate)} (총 3개월)

■ 멘토 역할

1) 신규입사자 입사 당일 에스코트
   (OJT 및 근로계약서 작성 후 인사팀에서 개별 안내 예정)

2) 입사일 PC 설명 및 세팅 안내
   (네이버웍스, NAC, FTC, 클라우디움, 복호화 등)

   > 초기 비밀번호는 hecto12!@ 입니다.

   - 업무망 / 인터넷망 비밀번호는 각각 별도 설정 필요
   - 클라우디움 비밀번호는 아이디 / 비밀번호 동일

3) 멘티와 교류가 필요한 인원을 선정하고 멘토링 활동에 초대

4) 조직의 목표, 방침, 기능, 커뮤니케이션 채널, 육성 프로그램 및 회사 내·외부 이용 가능 자원에 대한 정보 공유

5) 기타 멘티의 업무 수행 및 조직 적응에 필요한 제반 지원

■ 멘토 대시보드 링크
${link}

활동 사진 및 증빙은 멘토링 대시보드에 업로드해 주세요.

■ 활동 등록 방법
1. 위 링크로 접속합니다.
2. 해당 월 카드에서 [활동 추가] 버튼을 클릭합니다.
3. 활동일, 활동 내용, 활동 사진을 등록합니다.
4. 비용이 발생한 경우 '비용 사용 있음'을 체크하고 사용 금액을 입력한 후 영수증을 업로드합니다.
5. [저장] 버튼을 클릭합니다.
6. 등록된 활동은 목록에서 언제든지 확인·수정할 수 있습니다.

■ 월별 지급 기준 (매월 독립 정산)
- 지급 인정 활동 0~1회: 지급 없음
- 지급 인정 활동 2회: 최대 50,000원
- 지급 인정 활동 3회 이상: 최대 100,000원

※ 멘토링 활동비는 지급 기준 금액과 실제 사용금액을 비교하여 더 낮은 금액으로 지급됩니다.

예)
- 활동 3회 + 실제 사용금액 96,000원 → 96,000원 지급
- 활동 3회 + 실제 사용금액 30,000원 → 30,000원 지급
- 활동 3회 + 비용 사용 없음 → 지급 없음

※ 멘토링 활동은 활동 사진 등록 시 인정됩니다.
   비용 사용이 없는 활동도 인정 가능합니다.
   단, 비용 사용이 있는 경우에는 영수증 업로드와 사용 금액 입력이 필요합니다.

   사진은 식사 활동뿐 아니라 채움·틔움·배움 공간(회사 식당·카페·도서관) 이용, 사내 구성원 소개 및 교류 활동,
   신규입사자 적응 지원 활동 등 멘토링 활동을 확인할 수 있는 내용이면 인정 가능합니다.

감사합니다.
인재협업팀 드림`
}

export function generateInitialGuideMailHtml(record: MentoringRecord, link: string): string {
  const period = fmtPeriodMonthly(record.startDate, record.endDate)
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Apple SD Gothic Neo',AppleGothic,'Malgun Gothic',sans-serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

<!-- 헤더 -->
<tr><td style="background:#1e40af;padding:32px 40px;">
  <p style="margin:0;font-size:13px;color:#bfdbfe;">인재협업팀</p>
  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">멘토 선정 및 멘토링 프로그램 안내</h1>
</td></tr>

<!-- 본문 -->
<tr><td style="padding:36px 40px;">

  <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#374151;">
    안녕하세요.<br>인재협업팀입니다.<br><br>
    <strong>${record.mentorName}님</strong>께서는 신규입사자 <strong>${record.menteeName}님</strong>의 멘토로 선정되셨습니다.<br>
    멘토링 진행 부탁드리며, 아래 내용 확인 후 활동 부탁드립니다.
  </p>

  <!-- 입사일 / 기간 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border-left:4px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#1e40af;letter-spacing:0.5px;">입사일</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#1e3a8a;">${record.joinDate}</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border-left:4px solid #3b82f6;background:#eff6ff;border-radius:0 8px 8px 0;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#1e40af;letter-spacing:0.5px;">멘토링 활동 기간</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#1e3a8a;">${period} (총 3개월)</p>
    </td></tr>
  </table>

  <!-- 멘토 역할 -->
  <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 멘토 역할</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td style="padding:0 0 12px;">
      <p style="margin:0 0 3px;font-size:14px;font-weight:600;color:#374151;">1) 신규입사자 입사 당일 에스코트</p>
      <p style="margin:0 0 0 12px;font-size:13px;color:#6b7280;">(OJT 및 근로계약서 작성 후 인사팀에서 개별 안내 예정)</p>
    </td></tr>
    <tr><td style="padding:0 0 12px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#374151;">2) 입사일 PC 설명 및 세팅 안내</p>
      <p style="margin:0 0 6px 12px;font-size:13px;color:#6b7280;">(네이버웍스, NAC, FTC, 클라우디움, 복호화 등)</p>
      <table cellpadding="0" cellspacing="0" style="margin-left:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;">
        <tr><td style="padding:10px 14px;font-size:13px;color:#92400e;">
          💡 초기 비밀번호: <strong>hecto12!@</strong><br>
          <span style="font-size:12px;color:#a16207;">업무망/인터넷망 비밀번호 각각 별도 설정 필요 · 클라우디움 비밀번호는 아이디/비밀번호 동일</span>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 0 10px;"><p style="margin:0;font-size:14px;font-weight:600;color:#374151;">3) 멘티와 교류가 필요한 인원 선정 및 멘토링 활동 초대</p></td></tr>
    <tr><td style="padding:0 0 10px;"><p style="margin:0;font-size:14px;font-weight:600;color:#374151;">4) 조직의 목표, 방침, 기능, 커뮤니케이션 채널, 육성 프로그램 및 회사 내·외부 자원 정보 공유</p></td></tr>
    <tr><td><p style="margin:0;font-size:14px;font-weight:600;color:#374151;">5) 기타 멘티의 업무 수행 및 조직 적응에 필요한 제반 지원</p></td></tr>
  </table>

  <!-- 대시보드 버튼 -->
  <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 멘토 대시보드</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#374151;">활동 사진 및 증빙은 아래 버튼을 클릭하여 멘토링 대시보드에 업로드해 주세요.</p>
  <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td style="border-radius:8px;background:#2563eb;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:16px 36px;border-radius:8px;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">멘토링 대시보드 바로가기 →</a>
    </td></tr>
  </table>

  <!-- 활동 등록 방법 -->
  <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 활동 등록 방법</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">1</td><td style="padding-left:10px;font-size:14px;color:#374151;">위 버튼을 클릭하여 멘토링 대시보드에 접속합니다.</td></tr></table></td></tr>
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">2</td><td style="padding-left:10px;font-size:14px;color:#374151;">해당 월 카드에서 [활동 추가] 버튼을 클릭합니다.</td></tr></table></td></tr>
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">3</td><td style="padding-left:10px;font-size:14px;color:#374151;">활동일, 활동 내용, 활동 사진을 등록합니다.</td></tr></table></td></tr>
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">4</td><td style="padding-left:10px;font-size:14px;color:#374151;">비용 발생 시 '비용 사용 있음' 체크 → 사용 금액 입력 → 영수증 업로드.</td></tr></table></td></tr>
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">5</td><td style="padding-left:10px;font-size:14px;color:#374151;">[저장] 버튼을 클릭합니다.</td></tr></table></td></tr>
    <tr><td style="padding:5px 0;"><table cellpadding="0" cellspacing="0"><tr><td style="width:26px;height:26px;background:#2563eb;border-radius:50%;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#fff;">6</td><td style="padding-left:10px;font-size:14px;color:#374151;">등록된 활동은 목록에서 언제든지 확인·수정할 수 있습니다.</td></tr></table></td></tr>
  </table>

  <!-- 지급 기준 -->
  <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 월별 지급 기준 (매월 독립 정산)</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;border:2px solid #dc2626;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
    <tr style="background:#dc2626;">
      <th style="padding:10px 16px;font-size:13px;color:#fff;text-align:center;font-weight:700;width:50%;">인정 활동 횟수</th>
      <th style="padding:10px 16px;font-size:13px;color:#fff;text-align:center;font-weight:700;width:50%;">지급 한도</th>
    </tr>
    <tr style="background:#fef2f2;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">0 ~ 1회</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">지급 없음</td>
    </tr>
    <tr style="background:#fff7f7;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">2회</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">최대 50,000원</td>
    </tr>
    <tr style="background:#fef2f2;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">3회 이상</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">최대 100,000원</td>
    </tr>
  </table>
  <!-- 오해방지 문구 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">※ 멘토링 활동비는 지급 기준 금액과 실제 사용금액을 비교하여 더 낮은 금액으로 지급됩니다.</p>
      <p style="margin:0 0 4px;font-size:13px;color:#92400e;font-weight:600;">예)</p>
      <p style="margin:0 0 2px;font-size:13px;color:#92400e;">· 활동 3회 + 실제 사용금액 96,000원 → 96,000원 지급</p>
      <p style="margin:0 0 2px;font-size:13px;color:#92400e;">· 활동 3회 + 실제 사용금액 30,000원 → 30,000원 지급</p>
      <p style="margin:0;font-size:13px;color:#92400e;">· 활동 3회 + 비용 사용 없음 → 지급 없음</p>
    </td></tr>
  </table>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">※ 활동 사진 등록 시 인정 · 비용 없는 활동도 활동 횟수에는 인정되지만 실제 지급액은 발생하지 않음</p>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">※ 비용 있는 경우 영수증 업로드 + 사용 금액 입력 필수 · 최종 지급액은 실제 사용금액 기준으로 지급</p>
  <p style="margin:0 0 28px;font-size:13px;color:#6b7280;">※ 사진은 식사 활동뿐 아니라 채움·틔움·배움 공간(회사 식당·카페·도서관) 이용, 사내 구성원 소개 및 교류 활동, 신규입사자 적응 지원 활동 등 멘토링 활동 확인 가능 내용이면 인정</p>

  <p style="margin:0;font-size:14px;color:#374151;">감사합니다.<br><strong>인재협업팀 드림</strong></p>
</td></tr>

<!-- 푸터 -->
<tr><td style="background:#f1f5f9;padding:18px 40px;text-align:center;">
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

export function generateEndMailBody(): string {
  return `안녕하세요.
인재협업팀입니다.

이번 달 멘토링 활동 마감일이 다가와 활동 등록 및 증빙 자료 업로드 관련 안내드립니다.
활동 등록 및 증빙 자료 업로드가 완료되지 않은 경우 지급 인정이 어려울 수 있으니 기간 내 등록 부탁드립니다.

■ 활동 등록 마감 안내

멘토링 활동 등록은 매월 1일 14:00까지 완료 부탁드립니다.
1일이 공휴일 또는 빨간날인 경우 다음 영업일 14:00까지 등록 부탁드립니다.

■ 지급 기준 안내

- 0~1회: 지급 없음
- 2회: 최대 50,000원
- 3회 이상: 최대 100,000원

※ 멘토링 활동비는 지급 기준 금액과 실제 사용금액을 비교하여 더 낮은 금액으로 지급됩니다.

예)
- 활동 3회 + 실제 사용금액 96,000원 → 96,000원 지급
- 활동 3회 + 실제 사용금액 30,000원 → 30,000원 지급
- 활동 3회 + 비용 사용 없음 → 지급 없음

■ 증빙 등록 안내

- 활동 사진 등록 시 활동 인정 가능합니다.
- 비용 사용이 없는 활동도 인정 가능합니다.
- 비용 사용이 있는 경우 영수증 업로드와 사용 금액 입력이 필요합니다.
- 기간 내 미등록 건은 지급 인정이 어려울 수 있습니다.

사진은 식사 활동뿐 아니라 채움·틔움·배움 공간(회사 식당·카페·도서관) 이용, 사내 구성원 소개 및 교류 활동,
신규입사자 적응 지원 활동 등 멘토링 활동을 확인할 수 있는 내용이면 인정 가능합니다.

■ 활동비 지급 일정

멘토링 활동비는 사용월 기준 익월 10일 지급 예정입니다.
예: 5월 활동비는 6월 10일 지급
단, 공휴일 또는 휴무일이 포함된 경우 지급일은 전후로 변동될 수 있습니다.

감사합니다.
인재협업팀 드림`
}

export function generateEndMailHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Apple SD Gothic Neo',AppleGothic,'Malgun Gothic',sans-serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

<!-- 헤더 -->
<tr><td style="background:#7c3aed;padding:32px 40px;">
  <p style="margin:0;font-size:13px;color:#ddd6fe;">인재협업팀</p>
  <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">멘토링 활동 등록 및 증빙 자료 제출 안내</h1>
</td></tr>

<!-- 본문 -->
<tr><td style="padding:36px 40px;">

  <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#374151;">
    안녕하세요.<br>인재협업팀입니다.<br><br>
    이번 달 멘토링 활동 마감일이 다가와 활동 등록 및 증빙 자료 업로드 관련 안내드립니다.<br>
    기간 내 미등록 건은 지급 인정이 어려울 수 있으니 기간 내 등록 부탁드립니다.
  </p>

  <!-- 마감 안내 (빨간 카드) -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:2px solid #dc2626;border-radius:10px;background:#fef2f2;overflow:hidden;">
    <tr><td style="background:#dc2626;padding:10px 18px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">🚨 활동 등록 마감 안내</p>
    </td></tr>
    <tr><td style="padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#dc2626;">매월 1일 14:00까지 등록 완료 부탁드립니다.</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">1일이 공휴일 또는 빨간날인 경우 다음 영업일 14:00까지 등록 부탁드립니다.</p>
    </td></tr>
  </table>

  <!-- 지급 기준 (빨간 테이블 카드) -->
  <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 지급 기준</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:2px solid #dc2626;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
    <tr style="background:#dc2626;">
      <th style="padding:10px 16px;font-size:13px;color:#fff;text-align:center;font-weight:700;width:50%;">인정 활동 횟수</th>
      <th style="padding:10px 16px;font-size:13px;color:#fff;text-align:center;font-weight:700;width:50%;">지급 한도</th>
    </tr>
    <tr style="background:#fef2f2;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">0 ~ 1회</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">지급 없음</td>
    </tr>
    <tr style="background:#fff7f7;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">2회</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">최대 50,000원</td>
    </tr>
    <tr style="background:#fef2f2;">
      <td style="padding:10px 16px;font-size:14px;color:#374151;text-align:center;border-top:1px solid #fecaca;">3회 이상</td>
      <td style="padding:10px 16px;font-size:14px;color:#dc2626;font-weight:600;text-align:center;border-top:1px solid #fecaca;">최대 100,000원</td>
    </tr>
  </table>
  <!-- 오해방지 문구 -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;">
    <tr><td style="padding:14px 18px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#92400e;">※ 멘토링 활동비는 지급 기준 금액과 실제 사용금액을 비교하여 더 낮은 금액으로 지급됩니다.</p>
      <p style="margin:0 0 4px;font-size:13px;color:#92400e;font-weight:600;">예)</p>
      <p style="margin:0 0 2px;font-size:13px;color:#92400e;">· 활동 3회 + 실제 사용금액 96,000원 → 96,000원 지급</p>
      <p style="margin:0 0 2px;font-size:13px;color:#92400e;">· 활동 3회 + 실제 사용금액 30,000원 → 30,000원 지급</p>
      <p style="margin:0;font-size:13px;color:#92400e;">· 활동 3회 + 비용 사용 없음 → 지급 없음</p>
    </td></tr>
  </table>

  <!-- 증빙 등록 안내 -->
  <h2 style="margin:0 0 14px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 증빙 등록 안내</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#374151;">· 활동 사진 등록 시 활동 인정 가능합니다.</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#374151;">· 비용 없는 활동도 활동 횟수에는 인정되지만, 실제 지급액은 발생하지 않습니다.</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#374151;">· 비용 사용이 있는 경우 영수증 업로드와 사용 금액 입력이 필요합니다.</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#374151;">· 최종 지급액은 실제 사용금액 기준으로 지급됩니다.</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#dc2626;font-weight:600;">· 기간 내 미등록 건은 지급 인정이 어려울 수 있습니다.</td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;background:#faf5ff;border-left:4px solid #7c3aed;border-radius:0 8px 8px 0;">
    <tr><td style="padding:14px 18px;font-size:13px;color:#5b21b6;line-height:1.7;">
      사진 인정 범위: 식사 활동, 채움·틔움·배움 공간(회사 식당·카페·도서관) 이용, 사내 구성원 소개 및 교류 활동,<br>
      신규입사자 적응 지원 활동 등 멘토링 활동을 확인할 수 있는 내용이면 인정 가능합니다.
    </td></tr>
  </table>

  <!-- 지급 일정 (주황 카드) -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:2px solid #f97316;border-radius:10px;background:#fff7ed;overflow:hidden;">
    <tr><td style="background:#f97316;padding:10px 18px;">
      <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">📅 활동비 지급 일정</p>
    </td></tr>
    <tr><td style="padding:16px 18px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#c2410c;">사용월 기준 익월 10일 지급 예정</p>
      <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">예: 5월 활동비 → 6월 10일 지급</p>
      <p style="margin:0;font-size:13px;color:#6b7280;">단, 공휴일 또는 휴무일 포함 시 지급일 전후로 변동될 수 있습니다.</p>
    </td></tr>
  </table>

  <p style="margin:0;font-size:14px;color:#374151;">감사합니다.<br><strong>인재협업팀 드림</strong></p>
</td></tr>

<!-- 푸터 -->
<tr><td style="background:#f1f5f9;padding:18px 40px;text-align:center;">
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// 메일 발송 API 스텁
// ─────────────────────────────────────────────────────────────────────────────

export async function sendInitialGuideMail(record: MentoringRecord, cc?: string): Promise<void> {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const link   = `${origin}/mentor/${record.token}`
  await fetch('/api/send-mail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      to:      record.mentorEmail,
      ...(cc ? { cc } : {}),
      subject: '멘토 선정 및 멘토링 프로그램 안내',
      text:    generateInitialGuideMailBody(record, link),
      html:    generateInitialGuideMailHtml(record, link),
    }),
  }).catch(err => console.warn('[sendInitialGuideMail]', err))
}

export async function sendEndMail(record: MentoringRecord, cc?: string): Promise<void> {
  await fetch('/api/send-mail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      to:      record.mentorEmail,
      ...(cc ? { cc } : {}),
      subject: '멘토링 활동 등록 및 증빙 자료 제출 안내',
      text:    generateEndMailBody(),
      html:    generateEndMailHtml(),
    }),
  }).catch(err => console.warn('[sendEndMail]', err))
}

export async function sendBulkEndMail(emails: string[], cc?: string): Promise<void> {
  if (emails.length === 0) return
  await fetch('/api/send-mail', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      to:      emails.join(', '),
      ...(cc ? { cc } : {}),
      subject: '멘토링 활동 등록 및 증빙 자료 제출 안내',
      text:    generateEndMailBody(),
      html:    generateEndMailHtml(),
    }),
  }).catch(err => console.warn('[sendBulkEndMail]', err))
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
    joinDate: '2026-05-15',
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

  // ── 2: 2026-04 입사, 1개월차 3회 유효, 2개월차 진행중, 목표 작성 완료
  {
    id: '2',
    mentorName: '박멘토', mentorEmail: 'park.mentor@hecto.co.kr',
    menteeName: '최멘티',
    joinDate: '2026-04-07',
    joinMonth: '2026-04', startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_b4e5f6',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'a1', activityDate: '2026-04-05', content: '첫 만남 및 멘토링 계획 수립', memo: '',
            photoName: 'photo_01.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
          { id: 'a2', activityDate: '2026-04-15', content: '업무 적응 현황 공유 및 상담', memo: '',
            photoName: 'photo_02.jpg', photoUrl: '', hasCost: true, costAmount: 15000, receiptName: 'receipt_02.jpg', receiptUrl: '' },
          { id: 'a3', activityDate: '2026-04-25', content: '조직 문화 이해도 점검', memo: '',
            photoName: 'photo_03.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'a4', activityDate: '2026-05-08', content: '2개월차 목표 설정 미팅', memo: '',
            photoName: 'photo_04.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
          // hasCost=true이지만 영수증 없음 → 미인정
          { id: 'a5', activityDate: '2026-05-19', content: '실무 역량 강화 미팅', memo: '카페 미팅',
            photoName: 'photo_05.jpg', photoUrl: '', hasCost: true, costAmount: 25000, receiptName: '', receiptUrl: '' },
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
    joinDate: '2026-03-04',
    joinMonth: '2026-03', startDate: '2026-03-01', endDate: '2026-05-31',
    status: 'active', uploadStatus: 'enabled', uploadBlockReason: '', note: '',
    token: 'mentor_c7d8e9',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'b1', activityDate: '2026-03-05', content: '첫 만남', memo: '',
            photoName: 'p_b1.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
          { id: 'b2', activityDate: '2026-03-14', content: '업무 적응', memo: '',
            photoName: 'p_b2.jpg', photoUrl: '', hasCost: true, costAmount: 20000, receiptName: 'r_b2.pdf', receiptUrl: '' },
          { id: 'b3', activityDate: '2026-03-24', content: '조직 문화', memo: '',
            photoName: 'p_b3.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 2,
        activities: [
          { id: 'b4', activityDate: '2026-04-07', content: '목표 설정', memo: '',
            photoName: 'p_b4.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
          { id: 'b5', activityDate: '2026-04-16', content: '실무 역량 강화', memo: '',
            photoName: 'p_b5.jpg', photoUrl: '', hasCost: true, costAmount: 30000, receiptName: 'r_b5.pdf', receiptUrl: '' },
          { id: 'b6', activityDate: '2026-04-25', content: '중간 점검', memo: '',
            photoName: 'p_b6.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
        ],
      },
      {
        monthIndex: 3,
        activities: [
          { id: 'b7', activityDate: '2026-05-08', content: '3개월차 마무리', memo: '',
            photoName: 'p_b7.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
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
    joinDate: '2026-04-01',
    joinMonth: '2026-04', startDate: '2026-04-01', endDate: '2026-06-30',
    status: 'suspended', uploadStatus: 'blocked', uploadBlockReason: '멘티 퇴사',
    note: '5월 초 멘티 퇴사로 멘토링 중단',
    token: 'mentor_d2f3g4',
    months: [
      {
        monthIndex: 1,
        activities: [
          { id: 'c1', activityDate: '2026-04-10', content: '초기 미팅', memo: '',
            photoName: 'p_c1.jpg', photoUrl: '', hasCost: false, costAmount: 0, receiptName: '', receiptUrl: '' },
          { id: 'c2', activityDate: '2026-04-22', content: '업무 환경 안내', memo: '',
            photoName: 'p_c2.jpg', photoUrl: '', hasCost: true, costAmount: 18000, receiptName: 'r_c2.pdf', receiptUrl: '' },
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
