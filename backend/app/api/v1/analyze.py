"""
Automatic data analysis endpoint.
"""
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
from app.utils.ai_service import get_ai_suggestions

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalyzeDataRequest(BaseModel):
    """Request model for data analysis."""
    columns: List[str]
    rows: List[Dict[str, Any]]


class Insight(BaseModel):
    """Data insight model."""
    type: str  # "quality" or "analysis"
    title: str
    description: str
    severity: str  # "info", "warning", "error"
    recommendation: Optional[str] = None


class VisualizationSuggestion(BaseModel):
    """Suggested visualization configuration."""
    type: str  # "bar", "line", "scatter", "histogram", "pie"
    title: str
    description: Optional[str] = None
    x: Optional[str] = None
    y: Optional[str] = None
    category: Optional[str] = None
    value: Optional[str] = None
    column: Optional[str] = None


class OperationSuggestion(BaseModel):
    """Suggested data transformation operation."""
    type: str
    reason: str
    params: Dict[str, Any]


class AISuggestionsResponse(BaseModel):
    """Response model for AI suggestions."""
    insights: List[Insight]
    operation_suggestions: List[OperationSuggestion]
    visualization_suggestions: List[VisualizationSuggestion]


class AnalysisSummary(BaseModel):
    """Summary statistics."""
    total_rows: int
    total_columns: int
    numeric_columns: int
    text_columns: int
    completeness: float  # Percentage


class AnalyzeDataResponse(BaseModel):
    """Response model for data analysis."""
    insights: List[Insight]
    visualizations: List[VisualizationSuggestion]
    summary: AnalysisSummary


@router.post("/analyze-data", response_model=AnalyzeDataResponse)
async def analyze_data(request: AnalyzeDataRequest) -> AnalyzeDataResponse:
    """
    Automatically analyze data and return insights and visualization suggestions.
    
    Args:
        request: AnalyzeDataRequest with columns and rows
    
    Returns:
        AnalyzeDataResponse with insights, visualization suggestions, and summary
    """
    try:
        # Convert to DataFrame
        if not request.rows:
            raise HTTPException(
                status_code=400,
                detail="No data rows provided"
            )
        
        df = pd.DataFrame(request.rows)
        
        # Ensure all columns exist
        for col in request.columns:
            if col not in df.columns:
                df[col] = None
        
        # Reorder columns to match request
        df = df[request.columns]
        
        insights: List[Insight] = []
        
        # 1. Data Quality Insights
        null_counts = df.isnull().sum()
        total_nulls = null_counts.sum()
        if total_nulls > 0:
            cols_with_nulls = len(null_counts[null_counts > 0])
            null_percentage = (total_nulls / (len(df) * len(df.columns))) * 100
            insights.append(Insight(
                type="quality",
                title="Missing Data Detected",
                description=f"{total_nulls} null values found across {cols_with_nulls} column(s) ({null_percentage:.1f}% of data)",
                severity="warning" if null_percentage > 10 else "info",
                recommendation="Consider using 'Remove Blank Rows' or 'Fill Missing Values' operations"
            ))
        
        # 2. Duplicate Detection
        dup_count = df.duplicated().sum()
        if dup_count > 0:
            dup_percentage = (dup_count / len(df)) * 100
            insights.append(Insight(
                type="quality",
                title="Duplicate Rows Found",
                description=f"{dup_count} duplicate row(s) detected ({dup_percentage:.1f}% of rows)",
                severity="warning" if dup_percentage > 5 else "info",
                recommendation="Use 'Remove Duplicates' operation to clean data"
            ))
        
        # 3. Numeric Column Insights
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        for col in numeric_cols:
            if df[col].isnull().all():
                continue
            
            try:
                stats = df[col].describe()
                
                # Outlier detection (z-score > 3)
                non_null = df[col].dropna()
                if len(non_null) > 0:
                    mean_val = non_null.mean()
                    std_val = non_null.std()
                    
                    if std_val > 0:  # Avoid division by zero
                        z_scores = np.abs((non_null - mean_val) / std_val)
                        outliers = (z_scores > 3).sum()
                        
                        if outliers > 0:
                            outlier_percentage = (outliers / len(non_null)) * 100
                            insights.append(Insight(
                                type="analysis",
                                title=f"Outliers in {col}",
                                description=f"{outliers} value(s) ({outlier_percentage:.1f}%) are more than 3 standard deviations from mean",
                                severity="info",
                                recommendation=f"Review values > {mean_val + 3*std_val:.2f} or < {mean_val - 3*std_val:.2f}"
                            ))
                
                # Check for zero or negative values in columns that shouldn't have them
                if (non_null <= 0).any() and col.lower() in ['price', 'cost', 'amount', 'revenue', 'sales']:
                    negative_count = (non_null < 0).sum()
                    zero_count = (non_null == 0).sum()
                    if negative_count > 0 or zero_count > len(non_null) * 0.5:
                        insights.append(Insight(
                            type="quality",
                            title=f"Unexpected Values in {col}",
                            description=f"{negative_count} negative and {zero_count} zero values found",
                            severity="warning",
                            recommendation="Review and correct negative or zero values"
                        ))
            except Exception as e:
                logger.warning(f"Error analyzing numeric column {col}: {e}")
                continue
        
        # 4. Text Column Insights
        text_cols = df.select_dtypes(include=['object', 'string']).columns.tolist()
        for col in text_cols:
            if df[col].isnull().all():
                continue
            
            try:
                unique_count = df[col].nunique()
                total_count = len(df[col].dropna())
                
                if total_count > 0:
                    unique_ratio = unique_count / total_count
                    
                    # Very few unique values (likely categorical)
                    if unique_ratio < 0.01 and unique_count < 20:
                        insights.append(Insight(
                            type="analysis",
                            title=f"Low Variety in {col}",
                            description=f"Only {unique_count} unique value(s) in {total_count} rows (categorical data)",
                            severity="info",
                            recommendation="Consider using 'Aggregate' operation to group by this column"
                        ))
                    
                    # Very high variety (likely IDs or unique identifiers)
                    elif unique_ratio > 0.95:
                        insights.append(Insight(
                            type="analysis",
                            title=f"High Variety in {col}",
                            description=f"{unique_count} unique value(s) in {total_count} rows (likely unique identifiers)",
                            severity="info",
                            recommendation="This column may be suitable as a key for joins or merges"
                        ))
                    
                    # Check for very long strings (potential data quality issue)
                    max_length = df[col].astype(str).str.len().max()
                    if max_length > 500:
                        insights.append(Insight(
                            type="quality",
                            title=f"Long Text Values in {col}",
                            description=f"Some values exceed 500 characters (max: {max_length})",
                            severity="info",
                            recommendation="Consider splitting or truncating very long text values"
                        ))
            except Exception as e:
                logger.warning(f"Error analyzing text column {col}: {e}")
                continue
        
        # 5. Generate Visualization Suggestions
        viz_suggestions: List[VisualizationSuggestion] = []
        
        # Scatter plot: 2+ numeric columns
        if len(numeric_cols) >= 2:
            viz_suggestions.append(VisualizationSuggestion(
                type="scatter",
                title=f"Correlation: {numeric_cols[0]} vs {numeric_cols[1]}",
                x=numeric_cols[0],
                y=numeric_cols[1]
            ))
        
        # Bar chart: 1 text + 1 numeric
        if len(text_cols) >= 1 and len(numeric_cols) >= 1:
            # Find a text column with reasonable number of unique values (5-20)
            suitable_text_col = None
            for text_col in text_cols:
                unique_count = df[text_col].nunique()
                if 5 <= unique_count <= 20:
                    suitable_text_col = text_col
                    break
            
            if suitable_text_col:
                viz_suggestions.append(VisualizationSuggestion(
                    type="bar",
                    title=f"{numeric_cols[0]} by {suitable_text_col}",
                    category=suitable_text_col,
                    value=numeric_cols[0]
                ))
        
        # Histogram: 1+ numeric columns
        if len(numeric_cols) >= 1:
            viz_suggestions.append(VisualizationSuggestion(
                type="histogram",
                title=f"Distribution of {numeric_cols[0]}",
                column=numeric_cols[0]
            ))
        
        # Line chart: if there's a date-like column or sequential numeric
        date_like_cols = [col for col in df.columns if 'date' in col.lower() or 'time' in col.lower()]
        if len(date_like_cols) >= 1 and len(numeric_cols) >= 1:
            viz_suggestions.append(VisualizationSuggestion(
                type="line",
                title=f"{numeric_cols[0]} Over Time",
                x=date_like_cols[0],
                y=numeric_cols[0]
            ))
        
        # Pie chart: categorical with few values
        if len(text_cols) >= 1 and len(numeric_cols) >= 1:
            for text_col in text_cols:
                unique_count = df[text_col].nunique()
                if 2 <= unique_count <= 8:
                    viz_suggestions.append(VisualizationSuggestion(
                        type="pie",
                        title=f"Distribution of {text_col}",
                        category=text_col,
                        value=numeric_cols[0] if len(numeric_cols) > 0 else None
                    ))
                    break
        
        # Calculate summary statistics
        completeness = (1 - df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100 if len(df) > 0 else 0
        
        summary = AnalysisSummary(
            total_rows=len(df),
            total_columns=len(df.columns),
            numeric_columns=len(numeric_cols),
            text_columns=len(text_cols),
            completeness=round(completeness, 2)
        )
        
        return AnalyzeDataResponse(
            insights=insights,
            visualizations=viz_suggestions,
            summary=summary
        )
    
    except Exception as e:
        logger.error(f"Error analyzing data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze data: {str(e)}"
        )


@router.post("/ai-suggestions", response_model=AISuggestionsResponse)
async def ai_suggestions(request: AnalyzeDataRequest) -> AISuggestionsResponse:
    """
    Get AI-powered suggestions for data transformations and visualizations.
    """
    try:
        if not request.rows:
            raise HTTPException(
                status_code=400,
                detail="No data rows provided"
            )
        
        suggestions = await get_ai_suggestions(request.columns, request.rows)
        
        # Format the response to match AISuggestionsResponse model
        return AISuggestionsResponse(
            insights=[Insight(type="analysis", **i) for i in suggestions.get("insights", [])],
            operation_suggestions=[OperationSuggestion(**s) for s in suggestions.get("operation_suggestions", [])],
            visualization_suggestions=[VisualizationSuggestion(**v) for v in suggestions.get("visualization_suggestions", [])]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting AI suggestions: {e}", exc_info=True)
        # Return empty suggestions on error instead of failing completely
        return AISuggestionsResponse(
            insights=[Insight(type="quality", title="AI Analysis Error", description=str(e), severity="error")],
            operation_suggestions=[],
            visualization_suggestions=[]
        )
