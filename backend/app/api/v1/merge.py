"""
File merge and join endpoints.
"""
from typing import Dict, Any, List, Optional, Literal
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import pandas as pd
from pathlib import Path
import uuid
import openpyxl

from app.limiter import limiter
from app.api.v1.excel import file_storage, UPLOAD_DIR, _get_file_info
from app.utils.excel_loader import load_file_with_header_detection
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class MergeFilesRequest(BaseModel):
    """Request model for merging files."""
    fileIds: List[str]
    strategy: Literal["append", "join", "union"] = "append"
    joinColumn: Optional[str] = None  # Required for "join" strategy
    joinType: Literal["inner", "left", "right", "outer"] = "inner"  # For "join" strategy
    headerRowIndex: Optional[int] = None  # Optional header row index for all files


class MergeFilesResponse(BaseModel):
    """Response model for merged files."""
    mergedFileId: str
    fileName: str
    sheets: List[str]
    rowCount: int
    columnCount: int
    warning: Optional[str] = None


@router.post("/merge-files")
@limiter.limit("20/minute")
async def merge_files(request: Request, payload: MergeFilesRequest) -> MergeFilesResponse:
    """
    Merge multiple Excel files into one.
    
    Args:
        payload: MergeFilesRequest with fileIds, strategy, and optional joinColumn
    
    Returns:
        MergeFilesResponse with merged file information
    """
    if not payload.fileIds or len(payload.fileIds) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 files are required for merging"
        )
    
    if payload.strategy == "join" and not payload.joinColumn:
        raise HTTPException(
            status_code=400,
            detail="joinColumn is required for 'join' strategy"
        )
    
    # Get file info for all files
    file_infos = []
    for file_id in payload.fileIds:
        try:
            file_info = _get_file_info(file_id)
            file_infos.append(file_info)
        except HTTPException as e:
            raise HTTPException(
                status_code=404,
                detail=f"File with ID '{file_id}' not found: {e.detail}"
            )
    
    try:
        # Load all DataFrames
        dataframes = []
        all_sheets = set()
        
        for file_info in file_infos:
            file_path = Path(file_info["file_path"])
            # For merge, we'll use the first sheet of each file
            # (could be extended to merge specific sheets)
            sheet_name = file_info["sheets"][0]
            all_sheets.add(sheet_name)
            
            df, _, _ = load_file_with_header_detection(
                file_path,
                sheet_name=sheet_name,
                header_row_index=payload.headerRowIndex
            )
            dataframes.append(df)
        
        # Merge based on strategy
        if payload.strategy == "append":
            # Stack DataFrames vertically (must have same columns)
            # Align columns first
            all_columns = set()
            for df in dataframes:
                all_columns.update(df.columns)
            
            # Reindex all DataFrames to have same columns
            aligned_dfs = []
            for df in dataframes:
                aligned_df = df.reindex(columns=list(all_columns))
                aligned_dfs.append(aligned_df)
            
            merged_df = pd.concat(aligned_dfs, ignore_index=True)
            warning = None
            
        elif payload.strategy == "join":
            # SQL-like join on a column
            if len(dataframes) != 2:
                raise HTTPException(
                    status_code=400,
                    detail="Join strategy currently supports exactly 2 files"
                )
            
            df1, df2 = dataframes[0], dataframes[1]
            
            # Validate join column exists in both
            if payload.joinColumn not in df1.columns:
                raise HTTPException(
                    status_code=400,
                    detail=f"Join column '{payload.joinColumn}' not found in first file"
                )
            if payload.joinColumn not in df2.columns:
                raise HTTPException(
                    status_code=400,
                    detail=f"Join column '{payload.joinColumn}' not found in second file"
                )
            
            # Perform join
            if payload.joinType == "inner":
                merged_df = pd.merge(df1, df2, on=payload.joinColumn, how="inner")
            elif payload.joinType == "left":
                merged_df = pd.merge(df1, df2, on=payload.joinColumn, how="left")
            elif payload.joinType == "right":
                merged_df = pd.merge(df1, df2, on=payload.joinColumn, how="right")
            else:  # outer
                merged_df = pd.merge(df1, df2, on=payload.joinColumn, how="outer")
            
            warning = None
            
        else:  # union
            # Combine all columns from all files
            all_columns = set()
            for df in dataframes:
                all_columns.update(df.columns)
            
            # Reindex and combine
            aligned_dfs = []
            for df in dataframes:
                aligned_df = df.reindex(columns=list(all_columns))
                aligned_dfs.append(aligned_df)
            
            merged_df = pd.concat(aligned_dfs, ignore_index=True)
            warning = "Union strategy combines all columns from all files"
        
        # Save merged DataFrame to new Excel file
        merged_file_id = str(uuid.uuid4())
        merged_filename = f"merged_{merged_file_id}.xlsx"
        merged_file_path = UPLOAD_DIR / merged_filename
        
        merged_df.to_excel(merged_file_path, index=False, engine='openpyxl')
        
        # Read sheet names (will have one sheet)
        workbook = openpyxl.load_workbook(merged_file_path, read_only=True)
        sheet_names = workbook.sheetnames
        workbook.close()
        
        # Store merged file metadata
        file_storage[merged_file_id] = {
            "file_id": merged_file_id,
            "filename": f"merged_{len(payload.fileIds)}_files.xlsx",
            "file_path": str(merged_file_path),
            "sheets": sheet_names,
        }
        
        return MergeFilesResponse(
            mergedFileId=merged_file_id,
            fileName=f"merged_{len(payload.fileIds)}_files.xlsx",
            sheets=sheet_names,
            rowCount=len(merged_df),
            columnCount=len(merged_df.columns),
            warning=warning
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error merging files: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error merging files: {str(e)}"
        )

