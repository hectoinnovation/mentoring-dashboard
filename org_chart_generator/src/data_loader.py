import pandas as pd
from pathlib import Path


REQUIRED_COLS = ["본부", "팀", "이름", "직급", "정렬순서"]


def load(filepath: str) -> pd.DataFrame:
    path = Path(filepath)
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(filepath)
    else:
        df = pd.read_csv(filepath, encoding="utf-8-sig")

    df.columns = df.columns.str.strip()

    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {missing}")

    if "실" not in df.columns:
        df["실"] = ""
    if "직책" not in df.columns:
        df["직책"] = ""

    for col in ["본부", "실", "팀", "이름", "직급", "직책"]:
        df[col] = df[col].fillna("").astype(str).str.strip()

    df["정렬순서"] = pd.to_numeric(df["정렬순서"], errors="coerce").fillna(0).astype(int)

    df = df.sort_values(["본부", "실", "팀", "정렬순서"]).reset_index(drop=True)
    return df
