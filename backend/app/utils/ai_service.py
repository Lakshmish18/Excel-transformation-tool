import os
import json
import logging
import httpx
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Configure Edyx AI URL and Key
CUSTOM_AI_URL = os.getenv("CUSTOM_AI_URL", "https://edyx-backend.onrender.com/chat/")
AI_API_KEY = os.getenv("AI_API_KEY", "").strip("\"'")

AVAILABLE_OPERATIONS = [
    {"type": "filter", "label": "Filter Rows", "description": "Keep rows matching conditions"},
    {"type": "remove_duplicates", "label": "Remove Duplicates", "description": "Remove duplicate rows"},
    {"type": "remove_blank_rows", "label": "Remove Blank Rows", "description": "Remove rows with empty cells"},
    {"type": "text_cleanup", "label": "Text Cleanup", "description": "Trim, lowercase, remove special chars"},
    {"type": "select_columns", "label": "Select Columns", "description": "Keep only specific columns"},
    {"type": "replace", "label": "Find & Replace", "description": "Replace text in column"},
    {"type": "math", "label": "Math Operations", "description": "Add, subtract, multiply, divide"},
    {"type": "convert_to_numeric", "label": "Convert to Number", "description": "Parse text as numbers"},
    {"type": "sort", "label": "Sort", "description": "Order rows by column values"},
    {"type": "split_column", "label": "Split Column", "description": "Split text into multiple columns"},
    {"type": "merge_columns", "label": "Merge Columns", "description": "Combine multiple columns"},
    {"type": "gross_profit", "label": "Gross Profit", "description": "Revenue minus COGS"},
    {"type": "net_profit", "label": "Net Profit", "description": "Gross profit minus expenses"},
    {"type": "profit_loss", "label": "P&L Statement", "description": "Monthly/quarterly profit and loss"},
    {"type": "aggregate", "label": "Aggregate", "description": "Group and summarize data"},
    {"type": "date_format", "label": "Date Format", "description": "Convert date formats"},
]

PROMPT_TEMPLATE = """
You are a data expert. Analyze the following data schema and sample rows from an Excel file.
Provide suggestions for data cleaning, transformations, and visualizations.

Columns: {columns}
Sample Data: {sample_data}

Available Operations in our tool:
{operations_list}

Based on this data, return a JSON object with:
1. "insights": A list of interesting facts or potential data quality issues.
   Each insight should have: "title", "description", "severity" ("info", "warning").
2. "operation_suggestions": A list of operations that would be beneficial.
   Each suggestion should have: "type" (from the available operations list), "reason", "params" (suggested parameters for the operation, e.g., {{ "column": "ColName", "value": "x" }}).
3. "visualization_suggestions": A list of charts to better understand the data.
   Each should have: "type" ("bar", "line", "scatter", "pie", "histogram"), "title", "description", "x", "y", "category", "value", "column".

Return ONLY the JSON object. No other text.
"""

async def get_ai_suggestions(columns: List[str], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Get AI suggestions for data transformations and visualizations using Edyx API.
    """
    try:
        # Prepare sample data (limit to first 5 rows to save tokens)
        sample_rows = rows[:5]
        
        operations_text = "\n".join([f"- {op['type']}: {op['description']}" for op in AVAILABLE_OPERATIONS])
        
        prompt = PROMPT_TEMPLATE.format(
            columns=", ".join(columns),
            sample_data=json.dumps(sample_rows),
            operations_list=operations_text
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {AI_API_KEY}"
            }
            
            # Edyx API Payload Format
            payload = {
                "model": "situation-aware",
                "messages": [
                    { "role": "system", "content": "You are a data expert that only returns JSON." },
                    { "role": "user", "content": prompt }
                ],
                "temperature": 0.1,
                "max_tokens": 2048
            }
            
            logger.info(f"Sending request to Edyx API at {CUSTOM_AI_URL}")
            response = await client.post(CUSTOM_AI_URL, json=payload, headers=headers)
            
            if response.status_code != 200:
                error_body = response.text
                logger.error(f"Edyx API error ({response.status_code}): {error_body}")
                raise Exception(f"Edyx API failed with status {response.status_code}: {error_body[:200]}")
            
            # Extract content from response
            resp_data = response.json()
            
            # Edyx returns choices[0].message.content
            try:
                content = resp_data['choices'][0]['message']['content']
            except (KeyError, IndexError) as e:
                logger.error(f"Unexpected Edyx response format: {resp_data}")
                raise Exception(f"Unexpected response format from Edyx API: {str(e)}")

            if not content:
                logger.warning("Empty response content from Edyx API")
                return get_mock_suggestions(columns, rows)
            
            content = content.strip()
            # Handle cases where model might wrap JSON in code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # If it's not JSON, try to find the JSON-like part
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != -1:
                    return json.loads(content[start:end])
                raise
        
    except Exception as e:
        logger.error(f"Error getting AI suggestions from Edyx: {e}")
        return {
            "insights": [
                {
                    "title": "AI Analysis Failed",
                    "description": f"Edyx API Error: {str(e)}",
                    "severity": "info"
                }
            ],
            "operation_suggestions": [],
            "visualization_suggestions": []
        }

def get_mock_suggestions(columns: List[str], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Fallback suggestions when AI is unavailable."""
    return {
        "insights": [
            {
                "title": "Manual Analysis Required",
                "description": "AI suggestions are currently unavailable. Please review your data manually.",
                "severity": "info"
            }
        ],
        "operation_suggestions": [],
        "visualization_suggestions": []
    }
