from dataclasses import dataclass, field
from typing import List, Optional
import pandas as pd


@dataclass
class Member:
    name: str
    rank: str
    role: str
    order: int


@dataclass
class Team:
    name: str
    members: List[Member] = field(default_factory=list)

    @property
    def leader(self) -> Optional[Member]:
        for m in self.members:
            if m.role in ("팀장", "책임자", "수석"):
                return m
        return self.members[0] if self.members else None

    @property
    def col_span(self) -> int:
        from config import COLS_PER_PERSON
        return max(len(self.members), 1) * COLS_PER_PERSON


@dataclass
class Division:
    name: str
    teams: List[Team] = field(default_factory=list)
    leader_name: str = ""
    leader_rank: str = ""

    @property
    def col_span(self) -> int:
        return sum(t.col_span for t in self.teams)


@dataclass
class Department:
    name: str
    divisions: List[Division] = field(default_factory=list)
    leader_name: str = ""
    leader_rank: str = ""

    @property
    def col_span(self) -> int:
        return sum(d.col_span for d in self.divisions)

    @property
    def has_divisions(self) -> bool:
        return any(d.name for d in self.divisions)


def build(df: pd.DataFrame) -> List[Department]:
    departments: dict[str, Department] = {}

    dept_order = {}
    div_order = {}

    for _, row in df.iterrows():
        dept_name = row["본부"]
        div_name = row["실"]
        team_name = row["팀"]
        member = Member(
            name=row["이름"],
            rank=row["직급"],
            role=row["직책"],
            order=row["정렬순서"],
        )

        if dept_name not in departments:
            departments[dept_name] = Department(name=dept_name)
            dept_order[dept_name] = len(dept_order)

        dept = departments[dept_name]

        div_key = (dept_name, div_name)
        existing_div = next((d for d in dept.divisions if d.name == div_name), None)
        if existing_div is None:
            existing_div = Division(name=div_name)
            dept.divisions.append(existing_div)
            div_order[div_key] = len(div_order)

        existing_team = next((t for t in existing_div.teams if t.name == team_name), None)
        if existing_team is None:
            existing_team = Team(name=team_name)
            existing_div.teams.append(existing_team)

        existing_team.members.append(member)

    for dept in departments.values():
        for div in dept.divisions:
            for team in div.teams:
                team.members.sort(key=lambda m: m.order)
            leader = _find_division_leader(div)
            if leader:
                div.leader_name = leader.name
                div.leader_rank = leader.rank
        dept_leader = _find_dept_leader(dept)
        if dept_leader:
            dept.leader_name = dept_leader.name
            dept.leader_rank = dept_leader.rank

    return list(sorted(departments.values(), key=lambda d: dept_order[d.name]))


def _find_division_leader(div: Division) -> Optional[Member]:
    for team in div.teams:
        for m in team.members:
            if m.role in ("실장",):
                return m
    return None


def _find_dept_leader(dept: Department) -> Optional[Member]:
    for div in dept.divisions:
        for team in div.teams:
            for m in team.members:
                if m.role in ("본부장", "부장급본부장"):
                    return m
    return None
