# 색상 (RGB, AARRGGBB 형식)
COLOR_TITLE_BG = "00000000"        # 투명 (흰 배경)
COLOR_CEO_BG = "FF222222"          # 매우 진한 회색
COLOR_CEO_FG = "FFFFFFFF"          # 흰 글자
COLOR_DEPT_BG = "FFA5A5A5"         # 본부: 회색 (theme accent3)
COLOR_DEPT_FG = "FFFFFFFF"         # 본부 글자: 흰색
COLOR_DIV_BG = "FFFF6114"          # 실: 주황
COLOR_DIV_FG = "FFFFFFFF"          # 실 글자: 흰색
COLOR_TEAM_BG = "FFFFAE81"         # 팀: 연주황
COLOR_TEAM_FG = "FF000000"         # 팀 글자: 검정
COLOR_LEADER_BG = "FFFFF2CC"       # 팀장 강조: 연노랑
COLOR_MEMBER_BG = "00000000"       # 일반 구성원: 투명(흰)
COLOR_MEMBER_FG = "FF000000"       # 구성원 글자: 검정
COLOR_RANK_FG = "FF000000"         # 직급 글자: 검정

# 폰트
FONT_NAME = "맑은 고딕"

# 폰트 크기
FONT_TITLE = 22
FONT_CEO = 11
FONT_DEPT = 10
FONT_DIV = 9
FONT_TEAM = 9
FONT_MEMBER = 9
FONT_RANK = 9

# 열 너비 (엑셀 단위)
COL_LABEL_WIDTH = 6.125       # A열: 레이블
COL_SEP_WIDTH = 2.0           # B열: 구분선 (얇은 여백)
COL_NAME_WIDTH = 2.0          # 이름 셀 단위 폭 (3열 묶음)
COL_RANK_WIDTH = 2.0          # 직급 셀 단위 폭 (3열 묶음)
COLS_PER_PERSON = 6           # 1인당 차지하는 열 수

# 행 높이 (엑셀 단위)
ROW_TITLE = 33.75
ROW_DEPT = 33.0
ROW_DIV = 32.25
ROW_TEAM = 36.0
ROW_MEMBER = 30.75
ROW_GAP_SM = 15.75
ROW_GAP_MD = 20.25
ROW_GAP_LG = 27.75

# 고정 행 번호
ROW_NUM_TITLE = 2
ROW_NUM_CEO_LABEL = 6
ROW_NUM_CEO_NAME = 7
ROW_NUM_DEPT = 12
ROW_NUM_DEPT_LEADER = 13
ROW_NUM_GAP = 14           # 14~15: 본부~실 사이 여백
ROW_NUM_DIV = 16
ROW_NUM_DIV_LEADER = 17
ROW_NUM_GAP2 = 18          # 18~19: 실~팀 사이 여백
ROW_NUM_TEAM = 20
ROW_NUM_MEMBER_START = 21  # 구성원 시작 행

# 내용 시작 열 (1-based)
COL_CONTENT_START = 3       # C열부터 시작

# 레이블 열 위치
COL_LABEL = 1              # A열

# 테두리 스타일
BORDER_THIN = "thin"
BORDER_MEDIUM = "medium"
