import sys
import os
from datetime import datetime
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.data_loader import load
from src.org_tree import build
from src.exporter import generate


COMPANY_NAME = "주식회사 헥토이노베이션 조직도"
INPUT_FILE = "data/org_data.csv"
OUTPUT_DIR = "output"


def main():
    base = Path(__file__).parent
    input_path = base / INPUT_FILE
    output_dir = base / OUTPUT_DIR
    output_dir.mkdir(exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"org_chart_{timestamp}.xlsx"

    print("입력 파일:", input_path)
    df = load(str(input_path))
    print("로드 완료:", len(df), "명")

    departments = build(df)
    dept_names = [d.name for d in departments]
    print("본부:", dept_names)

    generate(departments, COMPANY_NAME, str(output_path))


if __name__ == "__main__":
    main()
