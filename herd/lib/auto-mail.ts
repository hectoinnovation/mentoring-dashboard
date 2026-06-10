/**
 * lib/auto-mail.ts — 자동 메일 발송 템플릿
 * D-7, D-1, D-Day, 입사 후 N일 기준 멘토 안내 메일
 */

export type AutoMailType = 'd7' | 'd1' | 'dday' | 'post7' | 'post30'

export const AUTO_MAIL_LABELS: Record<AutoMailType, string> = {
  d7:     'D-7 (입사 1주일 전)',
  d1:     'D-1 (입사 전날)',
  dday:   'D-Day (입사일)',
  post7:  '입사 후 7일',
  post30: '입사 후 30일',
}

export const AUTO_MAIL_DAYS: Record<AutoMailType, number> = {
  d7:     -7,
  d1:     -1,
  dday:    0,
  post7:   7,
  post30: 30,
}

export function getAutoMailSubject(type: AutoMailType, mentorName: string, joinDate: string): string {
  switch (type) {
    case 'd7':
      return `[멘토링 안내] ${mentorName}님, 신규 멘티 입사 D-7 안내`
    case 'd1':
      return `[멘토링 안내] ${mentorName}님, 신규 멘티 내일(${joinDate}) 입사 예정 — 에스코트 준비 안내`
    case 'dday':
      return `[멘토링 안내] ${mentorName}님, 오늘(${joinDate}) 신규 멘티 입사일입니다`
    case 'post7':
      return `[멘토링 안내] 입사 후 1주일 — 멘토링 활동 현황 확인 안내`
    case 'post30':
      return `[멘토링 안내] 1개월차 멘토링 활동 등록 마감 안내`
  }
}

function headerStyle(bg: string): string {
  return `background:${bg};padding:32px 40px;`
}

const baseStyle = `
  margin:0;padding:0;background:#f5f7fa;
  font-family:'Apple SD Gothic Neo',AppleGothic,'Malgun Gothic',sans-serif;color:#222;
`.replace(/\s+/g, ' ')

export function generateAutoMailHtml(
  type: AutoMailType,
  mentorName: string,
  menteeName: string,
  joinDate: string,
): string {
  const configs: Record<AutoMailType, { bg: string; badge: string; title: string; body: string }> = {
    d7: {
      bg: '#1e40af',
      badge: '🗓️ D-7',
      title: '신규 멘티 입사 1주일 전 안내',
      body: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#374151;">
          안녕하세요.<br>인재협업팀입니다.<br><br>
          <strong>${mentorName}님</strong>이 담당하시는 멘티 <strong>${menteeName}님</strong>이
          <strong>7일 후인 ${joinDate}에 입사</strong> 예정입니다.<br>
          에스코트 및 첫날 안내 준비를 부탁드립니다.
        </p>
        ${escortChecklist()}
      `,
    },
    d1: {
      bg: '#1d4ed8',
      badge: '📅 D-1',
      title: '신규 멘티 내일 입사 예정 — 에스코트 준비 안내',
      body: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#374151;">
          안녕하세요.<br>인재협업팀입니다.<br><br>
          <strong>${mentorName}님</strong>이 담당하시는 멘티 <strong>${menteeName}님</strong>이
          <strong>내일(${joinDate}) 입사</strong> 예정입니다.<br>
          내일 에스코트 일정을 최종 확인해 주시기 바랍니다.
        </p>
        ${escortChecklist()}
        ${urgentBanner('내일 입사 예정입니다. 에스코트 준비를 완료해주세요.')}
      `,
    },
    dday: {
      bg: '#7c3aed',
      badge: '🎉 D-Day',
      title: '오늘 신규 멘티 입사일입니다',
      body: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#374151;">
          안녕하세요.<br>인재협업팀입니다.<br><br>
          <strong>${mentorName}님</strong>이 담당하시는 멘티 <strong>${menteeName}님</strong>이
          <strong>오늘(${joinDate}) 입사</strong>합니다.<br>
          OJT 및 근로계약서 작성 후 인사팀에서 에스코트 안내 드릴 예정입니다.
        </p>
        ${urgentBanner('오늘 입사일입니다! 에스코트를 부탁드립니다.', '#7c3aed', '#faf5ff')}
        ${escortChecklist()}
      `,
    },
    post7: {
      bg: '#0891b2',
      badge: '📊 입사 후 7일',
      title: '멘토링 1주차 활동 현황 확인 안내',
      body: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#374151;">
          안녕하세요.<br>인재협업팀입니다.<br><br>
          <strong>${menteeName}님</strong>이 입사한 지 7일이 지났습니다.<br>
          멘토링 대시보드에서 활동 등록 현황을 확인해 주세요.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#ecfeff;border-left:4px solid #0891b2;border-radius:0 8px 8px 0;">
          <tr><td style="padding:14px 18px;font-size:14px;color:#164e63;line-height:1.7;">
            · 1차 활동 등록 현황을 확인해 주세요.<br>
            · 활동 사진 및 증빙 자료 등록은 멘토링 대시보드에서 가능합니다.<br>
            · 궁금한 사항은 인재협업팀으로 문의해 주세요.
          </td></tr>
        </table>
      `,
    },
    post30: {
      bg: '#dc2626',
      badge: '⚠️ 입사 후 30일',
      title: '1개월차 멘토링 활동 등록 마감 안내',
      body: `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#374151;">
          안녕하세요.<br>인재협업팀입니다.<br><br>
          <strong>${menteeName}님</strong>의 입사 후 30일이 경과하였습니다.<br>
          1개월차 멘토링 활동 등록 및 증빙 자료 업로드를 완료해 주세요.
        </p>
        ${urgentBanner('1개월차 활동 미등록 시 지급 인정이 어려울 수 있습니다.')}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:2px solid #dc2626;border-radius:10px;overflow:hidden;border-collapse:separate;border-spacing:0;">
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
      `,
    },
  }

  const c = configs[type]

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="${baseStyle}">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;">
<tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

<!-- 헤더 -->
<tr><td style="${headerStyle(c.bg)}">
  <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);">인재협업팀 · 자동 발송</p>
  <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);">${c.badge}</p>
  <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">${c.title}</h1>
</td></tr>

<!-- 본문 -->
<tr><td style="padding:36px 40px;">
  ${c.body}
  <p style="margin:24px 0 0;font-size:14px;color:#374151;">감사합니다.<br><strong>인재협업팀 드림</strong></p>
</td></tr>

<!-- 푸터 -->
<tr><td style="background:#f1f5f9;padding:16px 40px;text-align:center;">
  <p style="margin:0;font-size:12px;color:#9ca3af;">본 메일은 멘토링 관리 시스템에서 자동 발송된 메일입니다.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function escortChecklist(): string {
  return `
    <h2 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px;">■ 에스코트 체크리스트</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr><td style="padding:4px 0;font-size:14px;color:#374151;">☐ OJT 및 근로계약서 작성 후 인사팀 안내 확인</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#374151;">☐ PC 설명 및 세팅 안내 (네이버웍스, NAC, FTC, 클라우디움 등)</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#374151;">☐ 초기 비밀번호: <strong>hecto12!@</strong></td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#374151;">☐ 교류가 필요한 인원 선정 및 소개</td></tr>
      <tr><td style="padding:4px 0;font-size:14px;color:#374151;">☐ 조직 목표·방침·커뮤니케이션 채널 안내</td></tr>
    </table>
  `
}

function urgentBanner(msg: string, color = '#dc2626', bg = '#fef2f2'): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:2px solid ${color};border-radius:10px;background:${bg};overflow:hidden;">
      <tr><td style="background:${color};padding:10px 18px;">
        <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">🚨 알림</p>
      </td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;font-weight:600;color:${color};">
        ${msg}
      </td></tr>
    </table>
  `
}
