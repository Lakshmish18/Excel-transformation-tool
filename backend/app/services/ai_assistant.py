import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from openai import OpenAI

logger = logging.getLogger(__name__)


class OpenAIConfigError(RuntimeError):
    pass


_VALID_FILTER_OPERATORS = {
    "equals",
    "not_equals",
    "greater_than",
    "less_than",
    "greater_equal",
    "less_equal",
    "contains",
    "not_contains",
    "date_range",
}


_OP_REQUIRED_PARAMS: Dict[str, List[str]] = {
    # type -> required keys under params
    "filter": ["column", "operator", "value"],
    "replace": ["column", "oldValue", "newValue"],
    "math": ["operation", "colA", "colBOrValue", "newColumn"],
    "sort": ["columns"],
    "select_columns": ["columns"],
    "remove_duplicates": [],  # optional subset/keep
    "aggregate": ["aggregations"],
    "text_cleanup": ["column", "operations"],
    "split_column": ["column", "separator", "newColumns"],
    "merge_columns": ["columns", "newColumn"],
    "date_format": ["column", "outputFormat"],
    "remove_blank_rows": [],  # optional columns
    "convert_to_numeric": ["column"],
    "gross_profit": ["revenueColumn", "costOfGoodsSoldColumn", "newColumn"],
    "net_profit": ["grossProfitColumn", "expensesColumn", "newColumn"],
    "profit_loss": ["dateColumn", "revenueColumn", "costColumn", "period"],
}

_OP_OPTIONAL_PARAMS: Dict[str, List[str]] = {
    "filter": [],
    "replace": [],
    "math": [],
    "sort": [],
    "select_columns": [],
    "remove_duplicates": ["subset", "keep"],
    "aggregate": ["groupBy"],
    "text_cleanup": [],
    "split_column": [],
    "merge_columns": ["separator"],
    "date_format": [],
    "remove_blank_rows": ["columns"],
    "convert_to_numeric": ["errors"],
    "gross_profit": [],
    "net_profit": [],
    "profit_loss": [],
}


def _extract_json_object(text: str) -> Any:
    """
    Extract JSON from plain text / code fences and parse it.
    Raises json.JSONDecodeError if it can't be parsed.
    """
    # Fast path: direct JSON
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Look for ```json ... ``` fenced blocks
    fence = re.search(r"```(?:json)?\s*(.*?)\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        return json.loads(fence.group(1).strip())

    # Try to find the first { ... } block
    obj_match = re.search(r"(\{.*\})", text, flags=re.DOTALL)
    if obj_match:
        return json.loads(obj_match.group(1).strip())

    return json.loads(text)


def _sanitize_suggested_pipeline(pipeline: Any) -> List[Dict[str, Any]]:
    if not isinstance(pipeline, list):
        return []

    sanitized: List[Dict[str, Any]] = []
    for op in pipeline:
        if not isinstance(op, dict):
            continue
        op_type = op.get("type")
        params = op.get("params")
        if not isinstance(op_type, str) or not isinstance(params, dict):
            continue

        if op_type not in _OP_REQUIRED_PARAMS:
            continue

        required = _OP_REQUIRED_PARAMS[op_type]
        missing = [k for k in required if k not in params]
        if missing:
            continue

        # Validate a few nested shapes to avoid backend validator failures.
        try:
            if op_type == "filter":
                if params.get("operator") not in _VALID_FILTER_OPERATORS:
                    continue
                if params.get("operator") == "date_range":
                    val = params.get("value")
                    if not isinstance(val, dict) or "start" not in val or "end" not in val:
                        continue
            elif op_type == "sort":
                cols = params.get("columns")
                if not isinstance(cols, list) or len(cols) == 0:
                    continue
                # each item must be {column, ascending}
                if not all(isinstance(c, dict) and "column" in c and "ascending" in c for c in cols):
                    continue
            elif op_type == "select_columns":
                cols = params.get("columns")
                if not isinstance(cols, list) or len(cols) == 0:
                    continue
            elif op_type == "remove_duplicates":
                if "subset" in params and params["subset"] is not None and not isinstance(params["subset"], list):
                    continue
                if "keep" in params and params["keep"] not in (None, "first", "last", False):
                    continue
            elif op_type == "aggregate":
                aggs = params.get("aggregations")
                if not isinstance(aggs, dict) or len(aggs) == 0:
                    continue
            elif op_type == "text_cleanup":
                ops = params.get("operations")
                if not isinstance(ops, list) or len(ops) == 0:
                    continue
            elif op_type == "split_column":
                new_cols = params.get("newColumns")
                if not isinstance(new_cols, list) or len(new_cols) == 0:
                    continue
            elif op_type == "merge_columns":
                cols = params.get("columns")
                if not isinstance(cols, list) or len(cols) < 2:
                    continue
            elif op_type == "remove_blank_rows":
                if "columns" in params and params["columns"] is not None and not isinstance(params["columns"], list):
                    continue
            elif op_type == "convert_to_numeric":
                errors = params.get("errors")
                if errors is not None and errors not in ("coerce", "raise", "ignore"):
                    continue
            elif op_type == "profit_loss":
                if params.get("period") not in ("monthly", "quarterly"):
                    continue
        except Exception:
            # If any nested validation fails, skip this op.
            continue

        sanitized.append({"type": op_type, "params": params})

        # Keep it bounded for MVP stability.
        if len(sanitized) >= 5:
            break

    return sanitized


@dataclass
class AIAssistantConfig:
    model: str = "gpt-4o-mini"
    max_tokens: int = 1000
    cache_ttl_seconds: int = 3600


class AIAssistant:
    """AI-powered data analysis assistant."""

    def __init__(self, config: Optional[AIAssistantConfig] = None):
        self.config = config or AIAssistantConfig()
        self._client: Optional[OpenAI] = None
        self._cache: Dict[str, Tuple[float, Dict[str, Any]]] = {}

    def _get_client(self) -> OpenAI:
        if self._client is not None:
            return self._client

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise OpenAIConfigError("OPENAI_API_KEY is not configured")

        self._client = OpenAI(api_key=api_key)
        return self._client

    def _analysis_cache_key(self, df: pd.DataFrame, user_profile: str) -> str:
        # Fingerprint using shape + column names only (cheap, good enough for MVP).
        cols = list(map(str, df.columns[:80]))
        fingerprint = f"{len(df)}|{len(cols)}|{','.join(cols)}|{user_profile}"
        return hashlib.md5(fingerprint.encode("utf-8")).hexdigest()

    def analyze_data(self, df: pd.DataFrame, user_profile: str = "general") -> Dict[str, Any]:
        """
        Analyze uploaded data and provide insights + suggested operations.
        """
        try:
            cache_key = self._analysis_cache_key(df, user_profile)
            now = time.time()
            cached = self._cache.get(cache_key)
            if cached:
                expiry_ts, value = cached
                if now < expiry_ts:
                    return value

            # Build a compact summary (never the whole dataset).
            columns = [str(c) for c in df.columns]
            truncated = False
            if len(columns) > 30:
                truncated = True
                columns_for_summary = columns[:30]
            else:
                columns_for_summary = columns

            sample_rows = df.head(5)[columns_for_summary].to_dict("records")
            null_counts = df[columns_for_summary].isnull().sum()
            unique_counts = {col: df[col].nunique(dropna=True) for col in columns_for_summary}

            dtypes_all = df.dtypes.astype(str).to_dict()
            dtypes = {col: dtypes_all.get(col) for col in columns_for_summary}

            numeric_cols = df[columns_for_summary].select_dtypes(include=["number"]).columns.tolist()
            if len(numeric_cols) > 0:
                numeric_stats = df[numeric_cols].describe().to_dict()
            else:
                numeric_stats = {}

            data_summary: Dict[str, Any] = {
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": columns_for_summary,
                "truncated_columns": truncated,
                "dtypes": dtypes,
                "sample_rows": sample_rows,
                "null_counts": null_counts.to_dict(),
                "unique_counts": unique_counts,
                "numeric_stats": numeric_stats,
            }

            prompt = f"""
You are an expert data analyst helping a {user_profile} user analyze their Excel/CSV data.

DATA SUMMARY (summary only; do not ask for full data):
{json.dumps(data_summary, indent=2, default=str)}

Analyze and provide:
1) SUMMARY: 2-3 sentences overview
2) INSIGHTS: 3-5 key observations (patterns, distributions, issues)
3) DATA_QUALITY_NOTES: 1-5 quality issues (missingness, duplicates, anomalies)
4) RECOMMENDED_ACTIONS: 3-5 concrete actions
5) SUGGESTED_PIPELINE: 3-5 transformations as JSON operations.

IMPORTANT: The only allowed operation types are:
{', '.join(sorted(_OP_REQUIRED_PARAMS.keys()))}

OPERATION_PARAM_RULES (backend validator expects these exact param keys):
- filter: params={{"column": string, "operator": one of {sorted(_VALID_FILTER_OPERATORS)}, "value": any or {{"start":..., "end":...}} for date_range}}
- sort: params={{"columns": [{{"column": string, "ascending": boolean}}]}}
- remove_duplicates: params may include subset?: string[], keep?: "first"|"last"|false
- select_columns: params={{"columns": string[]}}
- replace: params={{"column": string, "oldValue": any, "newValue": any}}
- math: params={{"operation": "add"|"subtract"|"multiply"|"divide", "colA": string, "colBOrValue": string|number, "newColumn": string}}
- aggregate: params={{"aggregations": {{col: "sum"|"mean"|"average"|"count"|"min"|"max"|"std"|"median"}}, "groupBy"?: string[]}}
- text_cleanup: params={{"column": string, "operations": ["trim"|"lowercase"|"uppercase"|"remove_symbols"][]}}
- split_column: params={{"column": string, "separator": string, "newColumns": string[]}}
- merge_columns: params={{"columns": string[] (len>=2), "newColumn": string, "separator"?: string}}
- date_format: params={{"column": string, "outputFormat": string}}
- remove_blank_rows: params may include columns?: string[]
- convert_to_numeric: params={{"column": string, "errors"?: "coerce"|"raise"|"ignore"}}
- gross_profit: params={{"revenueColumn": string, "costOfGoodsSoldColumn": string, "newColumn": string}}
- net_profit: params={{"grossProfitColumn": string, "expensesColumn": string, "newColumn": string}}
- profit_loss: params={{"dateColumn": string, "revenueColumn": string, "costColumn": string, "period": "monthly"|"quarterly"}}

Each suggested pipeline item MUST be:
{{"type": "<one of the allowed types>", "params": {{ ... required params exactly as backend expects ... }} }}

Never invent unsupported operation types (e.g. do not use fill_nulls).
Use column names that exist in DATA SUMMARY columns.
If you can't confidently pick valid operations, return an empty suggested_pipeline.

Respond with VALID JSON ONLY (no markdown, no commentary) in this exact shape:
{{
  "summary": "...",
  "insights": ["...", "...", "..."],
  "data_quality_notes": ["...", "..."],
  "recommended_actions": ["...", "..."],
  "suggested_pipeline": [
    {{"type": "filter", "params": {{"column":"...", "operator":"greater_than", "value": 2015}}}}
  ]
}}
"""

            client = self._get_client()
            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "Always respond with valid JSON only."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4,
                max_tokens=self.config.max_tokens,
            )

            content = response.choices[0].message.content or "{}"
            parsed = _extract_json_object(content)

            suggested_pipeline = _sanitize_suggested_pipeline(parsed.get("suggested_pipeline"))
            result = {
                "summary": str(parsed.get("summary") or ""),
                "insights": [str(x) for x in (parsed.get("insights") or []) if isinstance(x, (str, int, float))],
                "data_quality_notes": [
                    str(x) for x in (parsed.get("data_quality_notes") or []) if isinstance(x, (str, int, float))
                ],
                "recommended_actions": [
                    str(x) for x in (parsed.get("recommended_actions") or []) if isinstance(x, (str, int, float))
                ],
                "suggested_pipeline": suggested_pipeline,
            }

            self._cache[cache_key] = (now + self.config.cache_ttl_seconds, result)
            return result
        except OpenAIConfigError:
            raise
        except Exception as e:
            logger.exception("AI analysis failed")
            return {
                "summary": f"Error analyzing data: {str(e)}",
                "insights": [],
                "data_quality_notes": [],
                "recommended_actions": [],
                "suggested_pipeline": [],
            }

    def explain_insight(self, data_context: Dict[str, Any], insight_type: str) -> str:
        try:
            client = self._get_client()
            prompt = f"""
Based on this data context:
{json.dumps(data_context, indent=2, default=str)}

Explain the {insight_type} in simple terms that a non-technical user can understand.

Constraints:
- Friendly and clear
- Under 100 words
- No markdown
"""

            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are a friendly data analyst explaining insights to users."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=200,
            )
            return (response.choices[0].message.content or "").strip()
        except OpenAIConfigError:
            raise
        except Exception as e:
            logger.exception("AI explain failed")
            return f"Unable to explain: {str(e)}"

    def suggest_next_step(self, current_state: Dict[str, Any]) -> str:
        try:
            client = self._get_client()
            prompt = f"""
The user is at this stage: {current_state.get('stage')}
User profile: {current_state.get('user_profile', 'general')}

Current pipeline: {json.dumps(current_state.get('current_pipeline', []), default=str)}

Suggest the SINGLE best next step for this user. Be specific and actionable.
Keep it under 50 words.
"""

            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are a helpful guide assisting users with data transformation."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=120,
            )
            return (response.choices[0].message.content or "").strip()
        except OpenAIConfigError:
            raise
        except Exception as e:
            logger.exception("AI suggest failed")
            return "Continue building your pipeline or run the transformation to see results."

    def chat(self, user_message: str, data_context: Dict[str, Any]) -> str:
        try:
            client = self._get_client()
            prompt = f"""
You are chatting with a user about their data.

DATA CONTEXT:
{json.dumps(data_context, indent=2, default=str)}

USER QUESTION: {user_message}

Provide a helpful answer in 2-3 sentences. Be conversational and friendly.
Answer directly without preamble.
"""
            response = client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are a friendly data assistant helping users understand their data."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.5,
                max_tokens=200,
            )
            return (response.choices[0].message.content or "").strip()
        except OpenAIConfigError:
            raise
        except Exception as e:
            logger.exception("AI chat failed")
            return "I'm having trouble analyzing that right now. Can you rephrase your question?"


# Singleton instance
ai_assistant = AIAssistant()

