import random
from pathlib import Path

import pandas as pd


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "demo"
    out_dir.mkdir(exist_ok=True)

    random.seed(0)
    df_students = pd.DataFrame(
        {
            "student_id": list(range(1, 101)),
            "name": [f"Student {i}" for i in range(1, 101)],
            "score": [random.randint(40, 100) for _ in range(100)],
            "assignment": ["Math Quiz"] * 100,
        }
    )
    df_students.to_excel(out_dir / "student-simple.xlsx", index=False)

    random.seed(1)
    df_sales = pd.DataFrame(
        {
            "order_id": list(range(1, 1001)),
            "product": random.choices(["Laptop", "Phone", "Tablet"], k=1000),
            "price": [random.randint(200, 2000) for _ in range(1000)],
            "quantity": [random.randint(1, 5) for _ in range(1000)],
            "region": random.choices(["North", "South", "East", "West"], k=1000),
        }
    )
    df_sales.to_excel(out_dir / "sales-data.xlsx", index=False)

    print(f"Wrote: {(out_dir / 'student-simple.xlsx').as_posix()}")
    print(f"Wrote: {(out_dir / 'sales-data.xlsx').as_posix()}")


if __name__ == "__main__":
    main()

