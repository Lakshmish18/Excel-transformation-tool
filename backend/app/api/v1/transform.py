"""
Transformation preview endpoint.
"""
import hashlib
import json
import logging
import time
from typing import List, Optional, Literal, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
import pandas as pd
from pathlib import Path
import uuid
import openpyxl

from app.models.operations import Operation
from app.transform_engine import apply_operations, ColumnNotFoundError, OperationValidationError, validate_operations
from app.limiter import limiter
from app.api.v1.excel import file_storage, OUTPUT_DIR, _get_file_info
from app.utils.excel_loader import load_file_with_header_detection
from app.utils.excel_export import export_styled_excel

logger = logging.getLogger(__name__)
router = APIRouter()

# Cache for transformation results (key -> (response_dict, expiry_ts))
TRANSFORM_CACHE: Dict[str, tuple] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour


def _safe_json_value(obj: Any) -> Any:
    """Convert value to JSON-serializable form."""
    if obj is None:
        return None
    if isinstance(obj, (bool, int, float, str)):
        return obj
    if hasattr(obj, "item"):  # numpy scalar (int64, float64, bool_, etc.)
        try:
            return obj.item()
        except (ValueError, AttributeError):
            return str(obj)
    if isinstance(obj, (pd.Timestamp, pd.Timedelta)):
        return str(obj)
    if isinstance(obj, dict):
        return {str(k): _safe_json_value(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_safe_json_value(v) for v in obj]
    if hasattr(pd, "isna") and callable(pd.isna) and pd.isna(obj):
        return None
    return str(obj)


def _rows_to_json_safe(df: pd.DataFrame, limit: int = 30) -> List[dict]:
    """Convert DataFrame rows to JSON-serializable list of dicts."""
    df_preview = df.head(limit)
    rows = []
    for _, series in df_preview.iterrows():
        row = {}
        for col in df_preview.columns:
            try:
                val = series[col]
                row[str(col)] = _safe_json_value(val)
            except Exception as e:
                logger.warning(f"Could not serialize cell {col}: {e}")
                row[str(col)] = str(val) if val is not None else ""
        rows.append(row)
    return rows


def generate_cache_key(file_id: str, sheet_name: str, operations: list) -> str:
    """Generate unique cache key for file + sheet + operations."""
    try:
        ops_list = [
            {"type": getattr(o, "type", str(o)), "params": _safe_json_value(getattr(o, "params", {}))}
            for o in operations
        ]
        ops_json = json.dumps(ops_list, sort_keys=True, default=str)
    except (TypeError, ValueError) as e:
        logger.warning(f"Cache key fallback due to serialization: {e}")
        ops_json = str(operations)
    raw = f"{file_id}:{sheet_name}:{ops_json}"
    return hashlib.md5(raw.encode()).hexdigest()


class TransformRequest(BaseModel):
    """Request model for transformation preview."""
    fileId: str
    sheetName: str
    operations: List[Operation]
    headerRowIndex: Optional[int] = None  # Optional explicit header row index


class CellChange(BaseModel):
    """Model for a single cell change."""
    rowIndex: int
    column: str
    oldValue: Any
    newValue: Any
    operationIndex: int
    operationType: str


class OperationChange(BaseModel):
    """Model for changes made by a single operation."""
    operationIndex: int
    operationType: str
    operationSummary: str
    cellsChanged: List[CellChange]
    rowsAffected: List[int]
    columnsAffected: List[str]


class TransformResponse(BaseModel):
    """Response model for transformation preview."""
    fileId: str
    sheetName: str
    columns: List[str]
    rows: List[dict]
    rowCountBefore: int
    rowCountAfter: int
    newColumns: List[str]
    headerRowIndex: Optional[int] = None
    warning: Optional[str] = None
    changes: List[OperationChange] = []  # Track all changes made


class ValidatePipelineRequest(BaseModel):
    """Request model for pipeline validation."""
    fileId: str
    sheetName: str
    operations: List[Operation]
    headerRowIndex: Optional[int] = None


class ValidationError(BaseModel):
    """Model for validation error."""
    opIndex: int
    opId: str
    opType: str
    message: str


class ValidatePipelineResponse(BaseModel):
    """Response model for pipeline validation."""
    ok: bool
    errors: List[ValidationError]


@router.post("/validate-pipeline")
@limiter.limit("30/minute")
async def validate_pipeline(request: Request, payload: ValidatePipelineRequest) -> ValidatePipelineResponse:
    """
    Validate a transformation pipeline without applying it.
    
    Args:
        request: ValidatePipelineRequest with fileId, sheetName, and operations
    
    Returns:
        ValidatePipelineResponse with validation results
    """
    # Get file info (checks both memory and disk)
    try:
        file_info = _get_file_info(payload.fileId)
    except HTTPException:
        raise
    
    file_path = Path(file_info["file_path"])
    
    # Validate sheet name
    if payload.sheetName not in file_info["sheets"]:
        available_sheets = ", ".join(file_info["sheets"])
        raise HTTPException(
            status_code=400,
            detail=f"Sheet '{payload.sheetName}' not found. Available sheets: {available_sheets}"
        )
    
    try:
        # Load the DataFrame with header detection (just for validation)
        df, _, _ = load_file_with_header_detection(
            file_path,
            sheet_name=payload.sheetName,
            header_row_index=payload.headerRowIndex,
            nrows=1  # Only need structure, not all data
        )
        
        # Validate operations
        validation_errors = validate_operations(df, payload.operations)
        
        # Convert to response format
        errors = [
            ValidationError(
                opIndex=err["opIndex"],
                opId=err["opId"],
                opType=err["opType"],
                message=err["message"]
            )
            for err in validation_errors
        ]
        
        return ValidatePipelineResponse(
            ok=len(errors) == 0,
            errors=errors
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during validation: {str(e)}"
        )


@router.post("/preview-transform")
@limiter.limit("30/minute")
async def preview_transform(request: Request, payload: TransformRequest) -> TransformResponse:
    """
    Preview transformation by applying operations to a sheet.
    Results are cached for repeated requests with same file/sheet/operations.

    Args:
        request: TransformRequest with fileId, sheetName, operations, and optional headerRowIndex

    Returns:
        TransformResponse with transformed preview data and metadata
    """
    cache_key = generate_cache_key(
        payload.fileId, payload.sheetName, payload.operations
    )
    now = time.time()
    if cache_key in TRANSFORM_CACHE:
        cached, expiry = TRANSFORM_CACHE[cache_key]
        if now < expiry:
            try:
                logger.debug(f"Transform cache hit: {cache_key[:8]}...")
                return TransformResponse(**cached)
            except Exception as e:
                logger.warning(f"Cache entry invalid, recomputing: {e}")
                del TRANSFORM_CACHE[cache_key]

    # Get file info (checks both memory and disk)
    try:
        file_info = _get_file_info(payload.fileId)
    except HTTPException:
        raise
    
    file_path = Path(file_info["file_path"])
    
    # Validate sheet name
    if payload.sheetName not in file_info["sheets"]:
        available_sheets = ", ".join(file_info["sheets"])
        raise HTTPException(
            status_code=400,
            detail=f"Sheet '{payload.sheetName}' not found. Available sheets: {available_sheets}"
        )
    
    try:
        # Load limited rows for preview (much faster for large files)
        # We'll load more rows than we need to ensure operations work correctly
        PREVIEW_LIMIT = 50  # Load 50 rows for preview, show first 30
        df_original, detected_header_row, warning = load_file_with_header_detection(
            file_path,
            sheet_name=payload.sheetName,
            header_row_index=payload.headerRowIndex,
            nrows=PREVIEW_LIMIT  # Limit rows for performance
        )
        row_count_before = len(df_original)
        
        # Get original columns
        original_columns = set(df_original.columns)
        
        # Log operations being applied
        logger.info(f"Applying {len(payload.operations)} operations to preview data")
        for i, op in enumerate(payload.operations):
            logger.info(f"Operation {i+1}: type={op.type}, params={op.params}")
        
        # Apply all operations at once (much faster)
        df_transformed = apply_operations(df_original, payload.operations)
        
        # Log transformation results
        logger.info(f"Transformation complete. Rows: {len(df_original)} -> {len(df_transformed)}")
        logger.info(f"Columns: {len(df_original.columns)} -> {len(df_transformed.columns)}")
        
        # Track changes by comparing before/after (only for preview rows)
        all_changes = []
        
        # Only track changes if we have operations and preview data
        if payload.operations and len(df_original) > 0:
            # Create a working copy for change tracking
            df_tracking = df_original.head(PREVIEW_LIMIT).copy()
            
            for i, operation in enumerate(payload.operations):
                df_before_track = df_tracking.copy()
                
                # Apply single operation to tracking copy
                df_tracking = apply_operations(df_before_track, [operation])
                
                # Track changes for this operation (only for preview rows)
                operation_changes = {
                    'operationIndex': i,
                    'operationType': operation.type,
                    'operationSummary': f"{operation.type}: {str(operation.params)}",
                    'cellsChanged': [],
                    'rowsAffected': [],
                    'columnsAffected': [],
                }
                
                # For replace operations, track exact cell changes (only in preview)
                if operation.type == 'replace':
                    column = operation.params.get('column')
                    old_value = operation.params.get('oldValue')
                    new_value = operation.params.get('newValue')
                    
                    if column in df_before_track.columns and column in df_tracking.columns:
                        # Handle type conversion for matching (same as apply_replace)
                        col_dtype = df_before_track[column].dtype
                        if pd.api.types.is_numeric_dtype(col_dtype):
                            try:
                                if pd.api.types.is_integer_dtype(col_dtype):
                                    old_value_typed = int(float(old_value)) if old_value is not None else old_value
                                elif pd.api.types.is_float_dtype(col_dtype):
                                    old_value_typed = float(old_value) if old_value is not None else old_value
                                else:
                                    old_value_typed = old_value
                            except (ValueError, TypeError):
                                old_value_typed = old_value
                        else:
                            old_value_typed = old_value
                        
                        # Find rows where value changed (only in preview range)
                        # Compare before and after to find actual changes
                        for row_idx in df_before_track.index:
                            if row_idx < len(df_tracking):
                                val_before = df_before_track.loc[row_idx, column]
                                val_after = df_tracking.loc[row_idx, column]
                                
                                # Check if value actually changed
                                if pd.notna(val_before) and pd.notna(val_after):
                                    # Handle type comparison
                                    try:
                                        if pd.api.types.is_numeric_dtype(col_dtype):
                                            if pd.api.types.is_integer_dtype(col_dtype):
                                                val_before_comp = int(float(val_before)) if pd.notna(val_before) else val_before
                                                old_val_comp = int(float(old_value_typed)) if pd.notna(old_value_typed) else old_value_typed
                                            else:
                                                val_before_comp = float(val_before) if pd.notna(val_before) else val_before
                                                old_val_comp = float(old_value_typed) if pd.notna(old_value_typed) else old_value_typed
                                        else:
                                            val_before_comp = str(val_before)
                                            old_val_comp = str(old_value_typed)
                                        
                                        if val_before_comp == old_val_comp and val_after != val_before:
                                            operation_changes['cellsChanged'].append({
                                                'rowIndex': int(row_idx),
                                                'column': column,
                                                'oldValue': str(val_before),
                                                'newValue': str(val_after),
                                                'operationIndex': i,
                                                'operationType': operation.type,
                                            })
                                            if int(row_idx) not in operation_changes['rowsAffected']:
                                                operation_changes['rowsAffected'].append(int(row_idx))
                                    except (ValueError, TypeError):
                                        # Fallback to string comparison
                                        if str(val_before) == str(old_value_typed) and str(val_after) != str(val_before):
                                            operation_changes['cellsChanged'].append({
                                                'rowIndex': int(row_idx),
                                                'column': column,
                                                'oldValue': str(val_before),
                                                'newValue': str(val_after),
                                                'operationIndex': i,
                                                'operationType': operation.type,
                                            })
                                            if int(row_idx) not in operation_changes['rowsAffected']:
                                                operation_changes['rowsAffected'].append(int(row_idx))
                        
                        if column not in operation_changes['columnsAffected']:
                            operation_changes['columnsAffected'].append(column)
                
                # For math operations, track new column creation
                elif operation.type == 'math':
                    new_column = operation.params.get('newColumn')
                    if new_column:
                        operation_changes['columnsAffected'].append(new_column)
                        operation_changes['rowsAffected'] = list(range(min(len(df_tracking), PREVIEW_LIMIT)))
                
                # For filter operations, track removed rows
                elif operation.type == 'filter':
                    removed_count = len(df_before_track) - len(df_tracking)
                    if removed_count > 0:
                        operation_changes['rowsAffected'] = list(range(min(removed_count, PREVIEW_LIMIT)))
                
                # For other operations that create columns
                elif operation.type in ['gross_profit', 'net_profit']:
                    new_column = operation.params.get('newColumn')
                    if new_column:
                        operation_changes['columnsAffected'].append(new_column)
                        operation_changes['rowsAffected'] = list(range(min(len(df_tracking), PREVIEW_LIMIT)))
                
                # For text_cleanup, track column changes
                elif operation.type == 'text_cleanup':
                    column = operation.params.get('column')
                    if column:
                        operation_changes['columnsAffected'].append(column)
                        operation_changes['rowsAffected'] = list(range(min(len(df_tracking), PREVIEW_LIMIT)))
                
                # Add to all_changes if there were changes
                if (operation_changes['cellsChanged'] or 
                    operation_changes['rowsAffected'] or 
                    operation_changes['columnsAffected']):
                    all_changes.append(operation_changes)
        row_count_after = len(df_transformed)
        
        # Get new columns (columns that weren't in the original)
        new_columns = [col for col in df_transformed.columns if col not in original_columns]
        
        # Convert to JSON-serializable format (handles numpy, pd.Timestamp, etc.)
        rows = _rows_to_json_safe(df_transformed, limit=30)
        # Normalize None to empty string for display
        for row in rows:
            for k, v in list(row.items()):
                if v is None:
                    row[k] = ""
        
        columns = [str(col) for col in df_transformed.columns]
        
        # Log sample of transformed data
        if rows:
            logger.info(f"Sample transformed row (first row): {rows[0]}")
        
        response = TransformResponse(
            fileId=payload.fileId,
            sheetName=payload.sheetName,
            columns=columns,
            rows=rows,
            rowCountBefore=row_count_before,
            rowCountAfter=row_count_after,
            newColumns=new_columns,
            headerRowIndex=detected_header_row,
            warning=warning,
            changes=all_changes,
        )
        # Cache result
        cache_entry = response.model_dump()
        TRANSFORM_CACHE[cache_key] = (cache_entry, now + CACHE_TTL_SECONDS)
        return response
    except OperationValidationError as e:
        # Return structured error for operation validation failure
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": "OPERATION_VALIDATION_ERROR",
                "operation_index": e.operation_index,
                "operation_id": e.operation_id,
                "operation_type": e.operation_type,
                "message": e.message
            }
        )
    except ColumnNotFoundError as e:
        # Return structured error for column not found
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": e.error_type,
                "column_name": e.column_name,
                "available_columns": e.available_columns,
                "message": str(e)
            }
        )
    except ValueError as e:
        error_str = str(e)
        # Check if it's a column not found error in the message
        if "COLUMN_NOT_FOUND" in error_str:
            # Parse the error message
            parts = error_str.split(": ")
            if len(parts) >= 2:
                column_name = parts[1].split("'")[1] if "'" in parts[1] else ""
                available_cols = parts[2].split(": ")[1].split(", ") if len(parts) >= 3 else []
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error_type": "COLUMN_NOT_FOUND",
                        "column_name": column_name,
                        "available_columns": available_cols,
                        "message": error_str
                    }
                )
        raise HTTPException(
            status_code=400,
            detail=f"Transformation error: {error_str}"
        )
    except Exception as e:
        err_msg = str(e).strip() or repr(e)
        logger.exception("Unexpected error in preview_transform: %s", err_msg)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing transformation: {err_msg}"
        )


@router.post("/export-transform")
async def export_transform(request: TransformRequest) -> FileResponse:
    """
    Apply transformations and export as Excel file for download.
    
    Args:
        request: TransformRequest with fileId, sheetName, operations, and optional headerRowIndex
    
    Returns:
        Excel file download
    """
    # Get file info (checks both memory and disk)
    try:
        file_info = _get_file_info(request.fileId)
    except HTTPException:
        raise
    
    file_path = Path(file_info["file_path"])
    
    # Validate sheet name
    if request.sheetName not in file_info["sheets"]:
        available_sheets = ", ".join(file_info["sheets"])
        raise HTTPException(
            status_code=400,
            detail=f"Sheet '{request.sheetName}' not found. Available sheets: {available_sheets}"
        )
    
    try:
        # Load the full DataFrame with header detection
        df_original, detected_header_row, warning = load_file_with_header_detection(
            file_path,
            sheet_name=request.sheetName,
            header_row_index=request.headerRowIndex
        )
        
        # Apply transformations
        df_transformed = apply_operations(df_original, request.operations)
        
        # Generate output filename
        output_id = str(uuid.uuid4())
        output_filename = f"transformed_{output_id}.xlsx"
        output_path = OUTPUT_DIR / output_filename

        # Write to Excel with professional styling
        export_styled_excel(df_transformed, output_path)
        
        # Return file for download
        return FileResponse(
            path=output_path,
            filename=f"transformed_{file_info['filename']}",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except OperationValidationError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": "OPERATION_VALIDATION_ERROR",
                "operation_index": e.operation_index,
                "operation_id": e.operation_id,
                "operation_type": e.operation_type,
                "message": e.message
            }
        )
    except ColumnNotFoundError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": e.error_type,
                "column_name": e.column_name,
                "available_columns": e.available_columns,
                "message": str(e)
            }
        )
    except ValueError as e:
        error_str = str(e)
        if "COLUMN_NOT_FOUND" in error_str:
            parts = error_str.split(": ")
            if len(parts) >= 2:
                column_name = parts[1].split("'")[1] if "'" in parts[1] else ""
                available_cols = parts[2].split(": ")[1].split(", ") if len(parts) >= 3 else []
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error_type": "COLUMN_NOT_FOUND",
                        "column_name": column_name,
                        "available_columns": available_cols,
                        "message": error_str
                    }
                )
        raise HTTPException(
            status_code=400,
            detail=f"Transformation error: {error_str}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error exporting transformation: {str(e)}"
        )


class BatchTransformRequest(BaseModel):
    """Request model for batch transformation."""
    fileIds: List[str]
    sheetName: str  # Same sheet name for all files
    operations: List[Operation]
    headerRowIndex: Optional[int] = None
    outputFormat: Literal["individual", "zip"] = "individual"


class BatchTransformResponse(BaseModel):
    """Response model for batch transformation."""
    results: List[Dict[str, Any]]  # List of {fileId, fileName, rowCountBefore, rowCountAfter}
    zipUrl: Optional[str] = None  # Backwards-compatible URL to download ZIP if outputFormat is "zip"
    zipId: Optional[str] = None  # Identifier for ZIP file; preferred for new clients
    errors: Optional[List[Dict[str, Any]]] = None  # Per-file errors when partial failure


@router.post("/batch-transform")
@limiter.limit("5/minute")
async def batch_transform(request: Request, payload: BatchTransformRequest) -> BatchTransformResponse:
    """
    Apply the same transformation pipeline to multiple files.
    
    Args:
        request: BatchTransformRequest with fileIds, sheetName, operations
    
    Returns:
        BatchTransformResponse with results for each file
    """
    if not payload.fileIds or len(payload.fileIds) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one file ID is required"
        )
    
    results = []
    errors = []
    
    for file_id in payload.fileIds:
        try:
            # Get file info
            file_info = _get_file_info(file_id)
            file_path = Path(file_info["file_path"])
            
            # Validate sheet exists
            if payload.sheetName not in file_info["sheets"]:
                errors.append({
                    "fileId": file_id,
                    "fileName": file_info["filename"],
                    "error": f"Sheet '{payload.sheetName}' not found"
                })
                continue
            
            # Load and transform
            df_original, _, _ = load_file_with_header_detection(
                file_path,
                sheet_name=payload.sheetName,
                header_row_index=payload.headerRowIndex
            )
            row_count_before = len(df_original)
            
            # Apply transformations
            df_transformed = apply_operations(df_original, payload.operations)
            row_count_after = len(df_transformed)
            
            if payload.outputFormat == "individual":
                # Save each transformed file
                output_id = str(uuid.uuid4())
                output_filename = f"transformed_{output_id}.xlsx"
                output_path = OUTPUT_DIR / output_filename
                
                df_transformed.to_excel(output_path, index=False, engine='openpyxl')
                
                results.append({
                    "fileId": file_id,
                    "fileName": file_info["filename"],
                    "transformedFileId": output_id,
                    "transformedFileName": f"transformed_{file_info['filename']}",
                    "rowCountBefore": row_count_before,
                    "rowCountAfter": row_count_after,
                })
            else:
                # For ZIP, we'll collect file paths
                results.append({
                    "fileId": file_id,
                    "fileName": file_info["filename"],
                    "rowCountBefore": row_count_before,
                    "rowCountAfter": row_count_after,
                    "dataFrame": df_transformed,  # Store for ZIP creation
                })
                
        except Exception as e:
            errors.append({
                "fileId": file_id,
                "fileName": file_info.get("filename", "unknown"),
                "error": str(e)
            })
            logger.error(f"Error processing file {file_id} in batch: {e}")
    
    # If ZIP format, create ZIP file
    zip_url = None
    zip_id: Optional[str] = None
    if payload.outputFormat == "zip" and results:
        try:
            import zipfile
            import tempfile
            from fastapi.responses import FileResponse
            
            zip_id = str(uuid.uuid4())
            zip_filename = f"batch_transformed_{zip_id}.zip"
            zip_path = OUTPUT_DIR / zip_filename
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for result in results:
                    if "dataFrame" in result:
                        # Create temporary Excel file
                        temp_file = OUTPUT_DIR / f"temp_{result['fileId']}.xlsx"
                        result["dataFrame"].to_excel(temp_file, index=False, engine='openpyxl')
                        # Add to ZIP
                        zipf.write(temp_file, result["fileName"])
                        # Clean up temp file
                        temp_file.unlink()
            
            # Store relative API path so clients using axios baseURL can resolve correctly.
            zip_url = f"/download-batch-zip?zipId={zip_id}"
            
        except Exception as e:
            logger.error(f"Error creating ZIP file: {e}")
            raise HTTPException(
                status_code=500,
                detail=f"Error creating ZIP file: {str(e)}"
            )
    
    response = BatchTransformResponse(
        results=[{k: v for k, v in r.items() if k != "dataFrame"} for r in results],
        zipUrl=zip_url,
        zipId=zip_id,
    )
    
    if errors:
        # Include errors in response but don't fail
        return BatchTransformResponse(
            results=response.results,
            zipUrl=response.zipUrl,
            errors=errors,
        )

    return response


@router.get("/download-batch-zip")
async def download_batch_zip(zipId: str = Query(...)) -> FileResponse:
    """
    Download a batch transformation ZIP file.
    """
    zip_path = OUTPUT_DIR / f"batch_transformed_{zipId}.zip"
    
    if not zip_path.exists():
        raise HTTPException(
            status_code=404,
            detail="ZIP file not found"
        )
    
    return FileResponse(
        path=zip_path,
        filename=f"batch_transformed_{zipId}.zip",
        media_type="application/zip"
    )
