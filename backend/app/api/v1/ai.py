import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.v1.excel import _get_file_info
from app.services.ai_assistant import OpenAIConfigError, ai_assistant
from app.utils.excel_loader import load_file_with_header_detection

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyzeRequest(BaseModel):
    fileId: str
    sheetName: Optional[str] = None
    userProfile: str = "general"


class ChatRequest(BaseModel):
    message: str
    dataContext: Dict[str, Any]


class ExplainRequest(BaseModel):
    dataContext: Dict[str, Any]
    insightType: str  # "kpi", "trend", "distribution"


class NextStepRequest(BaseModel):
    stage: str
    dataSummary: Dict[str, Any]
    currentPipeline: List[Dict[str, Any]]
    userProfile: str


def _load_df(file_path: Path, sheet_name: Optional[str]) -> pd.DataFrame:
    df, _detected_header_row, _warning = load_file_with_header_detection(
        file_path=file_path,
        sheet_name=sheet_name,
        header_row_index=None,
        nrows=None,  # Load full sheet for analysis (summary will be compact).
    )
    return df


@router.post("/analyze-data")
async def analyze_data(request: AnalyzeRequest) -> Dict[str, Any]:
    """
    Analyze uploaded data with AI.
    Returns:
      {
        "success": true,
        "analysis": { ... }
      }
    """
    try:
        file_info = _get_file_info(request.fileId)
        file_path = Path(file_info["file_path"])

        sheet_name = request.sheetName
        if not sheet_name:
            sheet_names = file_info.get("sheets") or []
            sheet_name = sheet_names[0] if sheet_names else "Sheet1"

        df = _load_df(file_path, sheet_name)

        try:
            analysis = ai_assistant.analyze_data(df, request.userProfile)
        except OpenAIConfigError as e:
            raise HTTPException(status_code=503, detail=str(e))

        return {"success": True, "analysis": analysis}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI analysis endpoint failed")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


@router.post("/chat")
async def chat_with_ai(request: ChatRequest) -> Dict[str, Any]:
    """Chat with AI about the data."""
    try:
        try:
            response = ai_assistant.chat(request.message, request.dataContext)
        except OpenAIConfigError as e:
            raise HTTPException(status_code=503, detail=str(e))

        return {"success": True, "response": response}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI chat endpoint failed")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.post("/explain-insight")
async def explain_insight(request: ExplainRequest) -> Dict[str, Any]:
    """Get AI explanation of insights/KPIs."""
    try:
        try:
            explanation = ai_assistant.explain_insight(request.dataContext, request.insightType)
        except OpenAIConfigError as e:
            raise HTTPException(status_code=503, detail=str(e))

        return {"success": True, "explanation": explanation}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI explain endpoint failed")
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@router.post("/suggest-next-step")
async def suggest_next_step(request: NextStepRequest) -> Dict[str, Any]:
    """Get AI suggestion for next step."""
    try:
        try:
            suggestion = ai_assistant.suggest_next_step(
                {
                    "stage": request.stage,
                    "data_summary": request.dataSummary,
                    "current_pipeline": request.currentPipeline,
                    "user_profile": request.userProfile,
                }
            )
        except OpenAIConfigError as e:
            raise HTTPException(status_code=503, detail=str(e))

        return {"success": True, "suggestion": suggestion}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("AI suggest endpoint failed")
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {str(e)}")

