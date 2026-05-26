import type { MentoringPair } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Mail template types
// ─────────────────────────────────────────────────────────────────────────────

export interface MailTemplate {
  to: string
  subject: string
  body: string   // plain text (모달 미리보기용)
  html: string   // HTML (실제 발송용)
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML wrapper
// ─────────────────────────────────────────────────────────────────────────────

function buildHtml(title: string, body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:20px;background:#f1f5f9;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .hdr{background:linear-gradient(135deg,#f97316,#f59e0b);padding:24px 28px}
  .hdr h1{margin:0;color:#fff;font-size:17px;font-weight:700}
  .hdr p{margin:4px 0 0;color:#fde68a;font-size:12px}
  .body{padding:28px;font-size:14px;color:#374151;line-height:1.8}
  .ftr{background:#f8fafc;padding:14px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af}
</style>
</head>
<body>
<div class="wrap">
  <div class="hdr">
    <h1>멘토링 운영 대시보드</h1>
    <p>${title}</p>
  </div>
  <div class="body">${escaped}</div>
  <div class="ftr">헥토이노베이션 인재협업팀</div>
</div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates
// ─────────────────────────────────────────────────────────────────────────────

/** 활동 부족 알림 — 이번 달 활동 2회 이하일 때 */
export function activityReminderTemplate(
  pair: MentoringPair,
  monthNo: number,
  currentCount: number,
): MailTemplate {
  const remaining = 3 - currentCount
  const body = `${pair.mentor_name} 멘토님 안녕하세요.

인재협업팀입니다.

현재 ${monthNo}개월차 멘토링 활동이 ${currentCount}회 등록되어 있습니다.
이번 달 지원금 지급 기준(3회 이상)까지 ${remaining}회 남아 있습니다.

📌 활동 등록 링크:
https://mentoring-dashboard.vercel.app/mentor/${pair.token}

활동일, 활동 내용, 사진을 등록해주시면 지원금 정산에 반영됩니다.

감사합니다.
인재협업팀 드림`

  return {
    to: pair.mentor_email,
    subject: `[멘토링] ${pair.mentor_name} 멘토님, ${monthNo}개월차 활동 등록을 부탁드립니다`,
    body,
    html: buildHtml('활동 등록 안내', body),
  }
}

/** 품의 미등록 알림 — 활동은 있지만 내부망 품의가 없을 때 */
export function proposalReminderTemplate(
  pair: MentoringPair,
  monthNo: number,
): MailTemplate {
  const body = `${pair.mentor_name} 멘토님 안녕하세요.

인재협업팀입니다.

${monthNo}개월차 멘토링 활동이 등록되었으나, 내부망 품의가 아직 등록되지 않은 항목이 있습니다.

지원금 지급을 위해서는 내부망 품의 등록이 반드시 필요합니다.

📋 내부망 품의 등록 방법:
내부망에서 "멘토링 활동/정산 신청서"를 검색하여 신청서를 제출해주세요.

품의 등록 완료 후 멘토 대시보드에서 "내부망 품의 등록 완료" 체크를 해주세요.
→ https://mentoring-dashboard.vercel.app/mentor/${pair.token}

감사합니다.
인재협업팀 드림`

  return {
    to: pair.mentor_email,
    subject: `[멘토링] ${monthNo}개월차 내부망 품의 등록 안내`,
    body,
    html: buildHtml('품의 등록 안내', body),
  }
}

/** 멘토링 종료 안내 */
export function completionNoticeTemplate(
  pair: MentoringPair,
  totalAmount: number,
): MailTemplate {
  const body = `${pair.mentor_name} 멘토님 안녕하세요.

인재협업팀입니다.

${pair.mentee_name} 멘티와의 3개월 멘토링 활동이 종료되었습니다.
소중한 멘토링 활동에 진심으로 감사드립니다.

━━━━━━━━━━━━━━━━━━━━━━━
📊 최종 정산 안내
━━━━━━━━━━━━━━━━━━━━━━━
멘토: ${pair.mentor_name}
멘티: ${pair.mentee_name}
운영 기간: ${pair.start_date} ~ ${pair.end_date}
최종 지급 예정금액: ${totalAmount.toLocaleString()}원
━━━━━━━━━━━━━━━━━━━━━━━

지급 일정은 별도 안내드릴 예정입니다.
내부망 품의가 아직 미완료된 항목이 있다면 빠른 시일 내에 등록해주세요.

감사합니다.
인재협업팀 드림`

  return {
    to: pair.mentor_email,
    subject: `[멘토링] ${pair.mentor_name} 멘토님 3개월 멘토링 종료 안내`,
    body,
    html: buildHtml('멘토링 종료 안내', body),
  }
}

/** 최초 안내 메일 — 멘토링 시작 시 */
export function initialGuideTemplate(pair: MentoringPair, dashboardUrl: string): MailTemplate {
  const body = `${pair.mentor_name} 멘토님 안녕하세요.

인재협업팀입니다.

이번 신입사원 멘토링 프로그램의 멘토로 선정되셨습니다.
담당 멘티는 ${pair.mentee_name} 님입니다.

━━━━━━━━━━━━━━━━━━━━━━━
[멘토의 역할]
━━━━━━━━━━━━━━━━━━━━━━━
• 멘티의 조직 적응 및 업무 역량 향상 지원
• 월 3회 이상 정기 활동 진행 및 기록
• 내부망 품의를 통한 정산 신청

[운영 기간]
${pair.start_date} ~ ${pair.end_date} (3개월)

[지원금 기준 (월별 독립 정산)]
0~1회 활동: 0원
2회 활동: 50,000원
3회 이상 활동: 100,000원 (최대 월 10만원, 총 30만원)

[멘토 전용 대시보드]
${dashboardUrl}

위 링크에서 활동 내용, 사진, 영수증 등록을 하실 수 있습니다.

※ 문의: 인재협업팀 안소정 (내선 XXXX)

감사합니다.
인재협업팀 드림`

  return {
    to: pair.mentor_email,
    subject: `[멘토링] ${pair.mentor_name} 멘토님, 멘토로 선정되셨습니다`,
    body,
    html: buildHtml('멘토링 시작 안내', body),
  }
}

/** 영수증 업로드 알림 — 관리자에게 발송 */
export function receiptUploadTemplate(
  pair: MentoringPair,
  monthNo: number,
  fileName: string | null,
): MailTemplate {
  const body = `안녕하세요, 인재협업팀.

${pair.mentor_name} 멘토님 → ${pair.mentee_name} 멘티

위 멘토링 페어의 ${monthNo}개월차 영수증이 업로드되었습니다.
${fileName ? `파일명: ${fileName}` : ''}

품의 처리 확인이 필요합니다.

📋 관리자 대시보드:
https://mentoring-dashboard.vercel.app/

감사합니다.
멘토링 대시보드 자동 발송`

  return {
    to: '',  // 서버에서 ADMIN_EMAIL 로 대체
    subject: `[멘토링] 영수증 업로드 - ${pair.mentor_name} 멘토 ${monthNo}개월차 품의 확인 요청`,
    body,
    html: buildHtml('영수증 업로드 알림', body),
  }
}
