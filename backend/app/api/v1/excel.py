"""
Core Excel file upload and preview endpoints for Phase 1.
"""
import os
import uuid
import logging
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Request
from fastapi.responses import FileResponse

from app.limiter import limiter
import pandas as pd
import openpyxl

from app.utils.excel_loader import load_file_with_header_detection
from app.utils.data_quality import calculate_data_quality_score
from app.utils.supabase_uploads import (
    is_remote_storage_configured,
    try_hydrate_upload_from_remote,
    upload_session_file,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# Directory to store uploaded/transformed files.
# Vercel's deployment filesystem is read-only, so use /tmp in serverless runtime.
if os.getenv("VERCEL"):
    _storage_root = Path(os.getenv("APP_STORAGE_DIR", "/tmp/excel_tool"))
else:
    _storage_root = Path(".")

UPLOAD_DIR = _storage_root / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = _storage_root / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory storage for file metadata (fileId -> file info)
file_storage: Dict[str, Dict[str, Any]] = {}

ALLOWED_EXTENSIONS = ['.xlsx', '.csv']
MAX_FILENAME_LENGTH = 255


def _looks_like_csv_bytes(content: bytes) -> bool:
    """Heuristic: detect text/CSV payload from initial bytes."""
    if not content:
        return False
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        return False
    # Basic CSV-ish signal: has line breaks and common separators.
    return ('\n' in text or '\r' in text) and (',' in text or ';' in text or '\t' in text)


async def _validate_upload_file(file: UploadFile) -> None:
    """Validate Excel or CSV file. Raises HTTPException on failure."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    if len(file.filename) > MAX_FILENAME_LENGTH:
        raise HTTPException(status_code=400, detail="Filename too long")
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported: {', '.join(ALLOWED_EXTENSIONS)}",
        )
    header = await file.read(8)
    await file.seek(0)
    if file_ext == '.xlsx':
        if not header.startswith(b'PK'):
            # Some users upload CSV content with .xlsx extension.
            sample = await file.read(4096)
            await file.seek(0)
            if _looks_like_csv_bytes(sample):
                # Mark for downstream processing as CSV.
                setattr(file, "_detected_ext", ".csv")
                logger.info("Upload appears to be CSV content with .xlsx extension: %s", file.filename)
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid file format. File does not appear to be a valid Excel file.",
                )
    elif file_ext == '.csv':
        try:
            test_content = await file.read(1024)
            test_content.decode('utf-8')
            await file.seek(0)
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV encoding. Use UTF-8.",
            )


def _get_sheet_names_fast(file_path: Path) -> List[str]:
    """
    Get sheet names from Excel file quickly by reading XML directly.
    This is MUCH faster than loading the entire workbook with openpyxl.
    
    Args:
        file_path: Path to the .xlsx file
        
    Returns:
        List of sheet names
    """
    # .xlsx files are ZIP archives - read directly from ZIP
    try:
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            # Read workbook.xml (tiny file, ~1KB)
            workbook_xml = zip_ref.read('xl/workbook.xml')
            
            # Parse XML
            root = ET.fromstring(workbook_xml)
            
            # Excel 2007+ namespace
            ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
            
            # Find all sheet elements
            sheets = root.findall(f'.//{ns}sheet')
            
            # If no sheets found with namespace, try alternative methods
            if not sheets:
                # Try without namespace
                sheets = root.findall('.//sheet')
            
            # If still no sheets, try iterating through all elements
            if not sheets:
                for elem in root.iter():
                    if 'sheet' in elem.tag.lower() and elem.get('name'):
                        sheets.append(elem)
            
            # Extract sheet names
            sheet_names = [sheet.get('name') for sheet in sheets if sheet.get('name')]
            
            if sheet_names:
                return sheet_names
            
            # If still no sheets, something is wrong - use fallback
            raise ValueError("No sheets found in XML")
            
    except (zipfile.BadZipFile, KeyError) as e:
        # Invalid ZIP file or missing workbook.xml
        raise ValueError(f"Invalid Excel file: {str(e)}")
    except (ET.ParseError, ValueError) as e:
        # XML parsing failed - fallback to openpyxl
        # This is slower but more reliable for edge cases
        logger.info(f"XML parsing failed, using openpyxl fallback: {e}")
        try:
            workbook = openpyxl.load_workbook(
                file_path, 
                read_only=True,
                data_only=False,
                keep_links=False,
                rich_text=False
            )
            sheet_names = workbook.sheetnames
            workbook.close()
            return sheet_names
        except Exception as openpyxl_error:
            raise ValueError(f"Could not read Excel file: {str(openpyxl_error)}")
    except Exception as e:
        # Any other unexpected error
        logger.error(f"Unexpected error reading Excel file: {e}", exc_info=True)
        raise ValueError(f"Error reading Excel file: {str(e)}")


def _rebuild_file_storage_from_disk():
    """
    Rebuild file_storage dictionary from files on disk.
    This helps recover file metadata after server restart.
    """
    if not UPLOAD_DIR.exists():
        return
    
    for pattern in ("*.xlsx", "*.csv"):
        for file_path in UPLOAD_DIR.glob(pattern):
            try:
                file_id = file_path.stem
                if file_id in file_storage:
                    continue
                if file_path.suffix.lower() == '.csv':
                    sheet_names = ['Sheet1']
                else:
                    sheet_names = _get_sheet_names_fast(file_path)
                file_storage[file_id] = {
                    "file_id": file_id,
                    "filename": f"recovered_{file_id}{file_path.suffix}",
                    "file_path": str(file_path),
                    "sheets": sheet_names,
                }
            except Exception as e:
                logger.warning(f"Could not rebuild metadata for {file_path}: {e}")


def _get_file_info(file_id: str) -> Dict[str, Any]:
    """
    Get file info, checking both in-memory storage and disk.
    Raises HTTPException if file not found.
    """
    # First check in-memory storage
    if file_id in file_storage:
        file_info = file_storage[file_id]
        file_path = Path(file_info["file_path"])
        # Verify file still exists on disk
        if file_path.exists():
            return file_info
        else:
            # File on disk was deleted, remove from storage
            del file_storage[file_id]
    
    # Not in memory, check if file exists on disk (.xlsx or .csv)
    for ext in ('.xlsx', '.csv'):
        file_path = UPLOAD_DIR / f"{file_id}{ext}"
        if file_path.exists():
            try:
                sheet_names = ['Sheet1'] if ext == '.csv' else _get_sheet_names_fast(file_path)
                file_info = {
                    "file_id": file_id,
                    "filename": f"recovered_{file_id}{ext}",
                    "file_path": str(file_path),
                    "sheets": sheet_names,
                }
                file_storage[file_id] = file_info
                return file_info
            except Exception as e:
                logger.error(f"Error reading file {file_id} from disk: {e}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error reading file from disk: {str(e)}"
                )
    
    # Serverless: upload may have hit another instance; hydrate from Supabase if configured.
    hydrated = try_hydrate_upload_from_remote(file_id, UPLOAD_DIR)
    if hydrated:
        file_path, filename, ext = hydrated
        try:
            sheet_names = ['Sheet1'] if ext == '.csv' else _get_sheet_names_fast(file_path)
            file_info = {
                "file_id": file_id,
                "filename": filename,
                "file_path": str(file_path),
                "sheets": sheet_names,
            }
            file_storage[file_id] = file_info
            return file_info
        except Exception as e:
            logger.error(f"Error hydrating file {file_id} from remote: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error reading file after remote fetch: {str(e)}",
            )

    if os.getenv("VERCEL") and not is_remote_storage_configured():
        raise HTTPException(
            status_code=503,
            detail=(
                "File not available on this server instance. For Vercel, set SUPABASE_URL and "
                "SUPABASE_SERVICE_ROLE_KEY on the backend and create a Storage bucket named "
                f"'excel-uploads' so uploads can be shared across instances."
            ),
        )

    raise HTTPException(
        status_code=404,
        detail=f"File with ID '{file_id}' not found. Please upload the file first.",
    )


@router.post("/upload-excel")
@limiter.limit("10/minute")
async def upload_excel(request: Request, file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Upload an Excel file and return file ID and sheet names.
    
    Args:
        file: Excel file (.xlsx)
    
    Returns:
        {
            "fileId": str,
            "fileName": str,
            "sheets": List[str]
        }
    """
    await _validate_upload_file(file)
    return await _process_single_file(file)


async def _process_single_file(file: UploadFile) -> Dict[str, Any]:
    """
    Process a single file upload (Excel or CSV).
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    file_ext = os.path.splitext(file.filename)[1].lower()
    detected_ext = getattr(file, "_detected_ext", file_ext)
    if detected_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Supported: {', '.join(ALLOWED_EXTENSIONS)}")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{detected_ext}"
    
    try:
        file_content = await file.read()
        file_path.write_bytes(file_content)
        
        if detected_ext == '.csv':
            sheet_names = ['Sheet1']
        else:
            sheet_names = _get_sheet_names_fast(file_path)
        
        # Step 3: Store metadata
        file_storage[file_id] = {
            "file_id": file_id,
            "filename": file.filename,
            "file_path": str(file_path),
            "sheets": sheet_names,
        }

        try:
            upload_session_file(file_id, file.filename, detected_ext, file_content)
        except Exception as e:
            if os.getenv("VERCEL"):
                logger.error("Remote upload required on Vercel but failed: %s", e)
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Could not persist upload for serverless. Check Supabase Storage bucket "
                        "'excel-uploads' and SUPABASE_SERVICE_ROLE_KEY."
                    ),
                ) from e
            logger.warning("Optional Supabase backup upload failed: %s", e)

        return {
            "fileId": file_id,
            "fileName": file.filename,
            "sheets": sheet_names,
        }
    except HTTPException:
        raise
    except ValueError as e:
        # Clean up on validation error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Clean up on any other error
        if file_path.exists():
            file_path.unlink()
        logger.error(f"Upload error for {file.filename}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@router.post("/upload-multiple-excel")
@limiter.limit("10/minute")
async def upload_multiple_excel(request: Request, files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    """
    Upload multiple Excel files and return file IDs and sheet names.
    
    Args:
        files: List of Excel files (.xlsx)
    
    Returns:
        {
            "files": [
                {
                    "fileId": str,
                    "fileName": str,
                    "sheets": List[str]
                },
                ...
            ],
            "errors": Optional[List[Dict]]  # If some files failed
        }
    """
    if not files or len(files) == 0:
        raise HTTPException(
            status_code=400,
            detail="No files provided"
        )
    
    for f in files:
        await _validate_upload_file(f)
    if len(files) == 1:
        # Single file, use existing endpoint logic
        result = await _process_single_file(files[0])
        return {"files": [result]}
    
    uploaded_files = []
    errors = []
    
    for idx, file in enumerate(files):
        try:
            result = await _process_single_file(file)
            uploaded_files.append(result)
        except HTTPException as e:
            errors.append({
                "fileName": file.filename or f"File {idx + 1}",
                "error": e.detail if isinstance(e.detail, str) else str(e.detail)
            })
        except Exception as e:
            errors.append({
                "fileName": file.filename or f"File {idx + 1}",
                "error": f"Unexpected error: {str(e)}"
            })
    
    if not uploaded_files:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to upload any files. Errors: {errors}"
        )
    
    response: Dict[str, Any] = {"files": uploaded_files}
    if errors:
        response["errors"] = errors
    
    return response


@router.get("/preview-sheet")
@limiter.limit("30/minute")
async def preview_sheet(
    request: Request,
    fileId: str = Query(..., description="File ID from upload"),
    sheetName: str = Query(..., description="Name of the sheet to preview"),
    limit: int = Query(10, ge=1, le=50, description="Number of rows to return"),
    headerRowIndex: Optional[int] = Query(None, description="Optional explicit header row index (0-based). If not provided, auto-detect.")
) -> Dict[str, Any]:
    """
    Preview first N rows of a specific sheet with automatic header detection.
    
    Args:
        fileId: File ID from upload endpoint
        sheetName: Name of the sheet to preview
        limit: Number of rows to return (default: 10, max: 50)
        headerRowIndex: Optional explicit header row index (0-based). If None, auto-detect.
    
    Returns:
        {
            "fileId": str,
            "sheetName": str,
            "columns": List[str],
            "rows": List[Dict[str, Any]],
            "headerRowIndex": int,
            "warning": Optional[str]
        }
    """
    # Get file info (checks both memory and disk)
    try:
        file_info = _get_file_info(fileId)
    except HTTPException as e:
        # Re-raise HTTP exceptions (404, 500 from _get_file_info)
        raise e
    except Exception as e:
        # Catch any other unexpected errors
        logger.error(f"Unexpected error getting file info for {fileId}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error accessing file: {str(e)}"
        )
    
    file_path = Path(file_info["file_path"])
    
    # Validate sheet name
    if sheetName not in file_info["sheets"]:
        available_sheets = ", ".join(file_info["sheets"])
        raise HTTPException(
            status_code=400,
            detail=f"Sheet '{sheetName}' not found. Available sheets: {available_sheets}"
        )
    
    try:
        df, detected_header_row, warning = load_file_with_header_detection(
            file_path,
            sheet_name=sheetName if file_path.suffix.lower() != '.csv' else None,
            header_row_index=headerRowIndex,
            nrows=limit
        )
        
        logger.info(f"Preview request: fileId={fileId}, sheetName={sheetName}, limit={limit}, rows={len(df)}, columns={len(df.columns)}")
        
        # Convert to list of dictionaries (rows)
        rows = df.fillna("").to_dict(orient='records')
        
        # Get column names
        columns = [str(col) for col in df.columns]

        # Calculate data quality score (use full data for accurate metrics - we have limit rows)
        quality_score = calculate_data_quality_score(df)

        response = {
            "fileId": fileId,
            "sheetName": sheetName,
            "columns": columns,
            "rows": rows,
            "headerRowIndex": detected_header_row,
            "quality": quality_score,
        }

        # Add warning if present
        if warning:
            response["warning"] = warning

        return response
    except ValueError as e:
        logger.error(f"ValueError reading sheet {sheetName} from file {fileId}: {e}")
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error reading sheet {sheetName} from file {fileId}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error reading sheet: {str(e)}"
        )


@router.get("/download-transformed")
async def download_transformed(
    fileId: str = Query(..., description="File ID from upload"),
    sheetName: str = Query(..., description="Name of the sheet"),
    headerRowIndex: Optional[int] = Query(None, description="Optional header row index")
) -> Dict[str, Any]:
    """
    Download transformed file (placeholder for future implementation).
    """
    raise HTTPException(
        status_code=501,
        detail="Download functionality not yet implemented"
    )
