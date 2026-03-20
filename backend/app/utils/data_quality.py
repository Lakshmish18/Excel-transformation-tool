"""
Data quality metrics for uploaded Excel/CSV files.
"""
import pandas as pd
from typing import Dict, List, Any


def calculate_data_quality_score(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Calculate comprehensive data quality metrics.

    Returns:
        - overall_score: 0-100
        - completeness: % of non-null values
        - duplicates: count and %
        - issues: list of detected problems
    """
    total_cells = df.size
    if total_cells == 0:
        return {
            "overall_score": 0,
            "completeness": 0,
            "duplicate_rows": 0,
            "duplicate_percentage": 0,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "issues": [],
            "column_quality": {},
        }

    null_cells = df.isnull().sum().sum()
    completeness_pct = ((total_cells - null_cells) / total_cells) * 100

    try:
        duplicate_rows = int(df.duplicated().sum())
    except (TypeError, ValueError):
        duplicate_rows = 0
    duplicate_pct = (duplicate_rows / len(df)) * 100 if len(df) > 0 else 0

    issues: List[Dict[str, str]] = []
    column_quality: Dict[str, Dict[str, Any]] = {}

    for col in df.columns:
        try:
            col_nulls = int(df[col].isnull().sum())
        except (TypeError, ValueError):
            col_nulls = 0
        col_null_pct = (col_nulls / len(df)) * 100 if len(df) > 0 else 0

        column_quality[str(col)] = {
            "nulls": int(col_nulls),
            "null_percentage": round(float(col_null_pct), 2),
        }

        if col_null_pct > 50:
            issues.append(
                {
                    "severity": "high",
                    "column": str(col),
                    "message": f"{col} is {col_null_pct:.1f}% empty",
                }
            )
        elif col_null_pct > 20:
            issues.append(
                {
                    "severity": "medium",
                    "column": str(col),
                    "message": f"{col} has {col_null_pct:.1f}% missing values",
                }
            )

    score = (
        completeness_pct * 0.5
        + (100 - duplicate_pct) * 0.3
        + (100 if len(issues) == 0 else max(0, 100 - len(issues) * 10)) * 0.2
    )

    return {
        "overall_score": round(min(100, max(0, score)), 1),
        "completeness": round(float(completeness_pct), 2),
        "duplicate_rows": int(duplicate_rows),
        "duplicate_percentage": round(float(duplicate_pct), 2),
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "issues": issues,
        "column_quality": column_quality,
    }
