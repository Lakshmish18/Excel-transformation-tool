"""
Utility module for robust Excel and CSV file loading with automatic header detection.
Handles files with intro rows, multiple header rows, or junk rows at the top.
"""
import pandas as pd
from pathlib import Path
from typing import Tuple, Optional, List, Dict, Any


def detect_header_row(df_raw: pd.DataFrame, max_rows_to_check: int = 10) -> Tuple[int, Optional[str]]:
    """
    Detect the most likely header row in a DataFrame.
    
    Heuristic:
    - Find the first row where most cells are non-null
    - At least one cell is not purely numeric
    - Row has at least 2 non-null values (to avoid single-value rows)
    
    Args:
        df_raw: DataFrame read with header=None
        max_rows_to_check: Maximum number of rows to inspect (default: 10)
    
    Returns:
        Tuple of (header_row_index, warning_message)
        - header_row_index: 0-based index of the detected header row, or 0 if not found
        - warning_message: Warning string if detection was uncertain, None if confident
    """
    rows_to_check = min(max_rows_to_check, len(df_raw))
    
    best_row = 0
    best_score = 0
    scores = []
    
    for row_idx in range(rows_to_check):
        row = df_raw.iloc[row_idx]
        
        # Count non-null values
        non_null_count = row.notna().sum()
        
        # Check if row has at least 2 non-null values
        if non_null_count < 2:
            scores.append(0)
            continue
        
        # Count non-numeric values (likely text headers)
        non_numeric_count = 0
        for val in row:
            if pd.notna(val):
                val_str = str(val).strip()
                # Check if it's not purely numeric
                if val_str and not val_str.replace('.', '').replace('-', '').isdigit():
                    non_numeric_count += 1
        
        # Score: prioritize rows with more non-null values and non-numeric content
        score = non_null_count * 2 + non_numeric_count
        
        scores.append(score)
        if score > best_score:
            best_score = score
            best_row = row_idx
    
    # If best row is 0 and score is low, might be uncertain
    warning = None
    if best_row == 0 and best_score < 4:
        warning = "Could not confidently detect header row. Using first row as header."
    elif best_row > 0:
        warning = f"Detected header row at index {best_row + 1} (skipped {best_row} intro row(s))."
    
    return best_row, warning


def load_excel_with_header_detection(
    file_path: Path,
    sheet_name: str,
    header_row_index: Optional[int] = None,
    nrows: Optional[int] = None
) -> Tuple[pd.DataFrame, int, Optional[str]]:
    """
    Load an Excel file with automatic or explicit header row detection.
    
    Args:
        file_path: Path to the Excel file
        sheet_name: Name of the sheet to load
        header_row_index: Optional explicit header row index (0-based). If None, auto-detect.
        nrows: Optional limit on number of data rows to read (for preview)
    
    Returns:
        Tuple of (DataFrame, detected_header_row_index, warning_message)
        - DataFrame: Loaded DataFrame with proper headers
        - detected_header_row_index: The header row index used (0-based)
        - warning_message: Warning if auto-detection was used, None if explicit
    """
    # First, read without header to inspect raw data
    # For detection, read first 20 rows. For explicit header, read enough to validate.
    try:
        read_rows = 20 if header_row_index is None else (header_row_index + 5)
        df_raw = pd.read_excel(
            file_path,
            sheet_name=sheet_name,
            header=None,
            nrows=read_rows
        )
    except Exception as e:
        raise ValueError(f"Error reading Excel file: {str(e)}")
    
    warning = None
    
    if header_row_index is not None:
        # Use explicit header row
        if header_row_index < 0 or header_row_index >= len(df_raw):
            raise ValueError(
                f"Header row index {header_row_index} is out of range. "
                f"Sheet has {len(df_raw)} rows."
            )
        detected_row = header_row_index
    else:
        # Auto-detect header row
        detected_row, warning = detect_header_row(df_raw)
    
    # Re-read with the detected/explicit header row
    # Skip rows before the header
    skiprows = list(range(detected_row)) if detected_row > 0 else None
    
    try:
        df = pd.read_excel(
            file_path,
            sheet_name=sheet_name,
            header=0,
            skiprows=skiprows,
            nrows=nrows
        )
    except Exception as e:
        raise ValueError(f"Error reading Excel sheet '{sheet_name}': {str(e)}")
    
    # Clean up column names (remove extra whitespace, handle Unnamed columns)
    df.columns = [str(col).strip() if pd.notna(col) else f"Column_{i}" 
                  for i, col in enumerate(df.columns)]
    
    return df, detected_row, warning


def load_csv_with_header_detection(
    file_path: Path,
    header_row_index: Optional[int] = None,
    nrows: Optional[int] = None
) -> Tuple[pd.DataFrame, int, Optional[str]]:
    """
    Load a CSV file with automatic or explicit header row detection.
    
    Args:
        file_path: Path to the CSV file
        header_row_index: Optional explicit header row index (0-based). If None, auto-detect.
        nrows: Optional limit on number of data rows to read (for preview)
    
    Returns:
        Tuple of (DataFrame, detected_header_row_index, warning_message)
    """
    try:
        df_raw = pd.read_csv(file_path, header=None, nrows=20, encoding='utf-8')
    except UnicodeDecodeError:
        raise ValueError("Invalid CSV encoding. Use UTF-8.")
    except Exception as e:
        raise ValueError(f"Error reading CSV file: {str(e)}")
    
    warning = None
    
    if header_row_index is not None:
        if header_row_index < 0 or header_row_index >= len(df_raw):
            raise ValueError(f"Header row index {header_row_index} is out of range.")
        detected_row = header_row_index
    else:
        detected_row, warning = detect_header_row(df_raw)
    
    skiprows = list(range(detected_row)) if detected_row > 0 else None
    
    try:
        df = pd.read_csv(
            file_path,
            header=0,
            skiprows=skiprows,
            nrows=nrows,
            encoding='utf-8'
        )
    except Exception as e:
        raise ValueError(f"Error reading CSV: {str(e)}")
    
    df.columns = [str(col).strip() if pd.notna(col) else f"Column_{i}"
                  for i, col in enumerate(df.columns)]
    
    return df, detected_row, warning


def load_file_with_header_detection(
    file_path: Path,
    sheet_name: Optional[str] = None,
    header_row_index: Optional[int] = None,
    nrows: Optional[int] = None
) -> Tuple[pd.DataFrame, int, Optional[str]]:
    """
    Load Excel or CSV file with header detection. Dispatches based on file extension.
    """
    ext = file_path.suffix.lower()
    if ext == '.csv':
        return load_csv_with_header_detection(file_path, header_row_index, nrows)
    if ext in ('.xlsx', '.xls'):
        return load_excel_with_header_detection(
            file_path,
            sheet_name=sheet_name or 'Sheet1',
            header_row_index=header_row_index,
            nrows=nrows
        )
    raise ValueError(f"Unsupported file type: {ext}")

