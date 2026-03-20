"""Tests for API endpoints (health, validate-pipeline, preview-transform)."""
import io
import pytest
import pandas as pd
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.api.v1.excel import file_storage, UPLOAD_DIR
from app.services.ai_assistant import ai_assistant, OpenAIConfigError

client = TestClient(app)


def _make_excel_bytes() -> bytes:
    """Create a minimal .xlsx in memory."""
    df = pd.DataFrame({"A": [1, 2], "B": [3, 4]})
    buf = io.BytesIO()
    df.to_excel(buf, index=False, engine="openpyxl")
    buf.seek(0)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def clear_file_storage():
    """Clear in-memory file storage before each test."""
    file_storage.clear()
    yield
    file_storage.clear()


class TestHealth:
    def test_health_returns_200(self):
        r = client.get("/api/v1/health")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") in ("ok", "healthy")


class TestUploadAndPreview:
    def test_upload_excel_returns_file_id(self):
        r = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert r.status_code == 200
        data = r.json()
        assert "fileId" in data
        assert data["fileName"] == "test.xlsx"
        assert "Sheet1" in data["sheets"]

    def test_preview_sheet_after_upload(self):
        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]
        r = client.get("/api/v1/preview-sheet", params={"fileId": file_id, "sheetName": "Sheet1", "limit": 10})
        assert r.status_code == 200
        data = r.json()
        assert "columns" in data
        assert "rows" in data
        assert "A" in data["columns"] and "B" in data["columns"]


class TestValidatePipeline:
    def test_validate_pipeline_missing_file_returns_400(self):
        r = client.post(
            "/api/v1/validate-pipeline",
            json={
                "fileId": "nonexistent",
                "sheetName": "Sheet1",
                "operations": [],
            },
        )
        assert r.status_code in (400, 404)

    def test_validate_pipeline_valid_ops(self):
        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]
        r = client.post(
            "/api/v1/validate-pipeline",
            json={
                "fileId": file_id,
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "A", "operator": "equals", "value": 1}},
                ],
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "ok" in data
        assert data["ok"] is True
        assert data["errors"] == []

    def test_validate_pipeline_invalid_column_returns_errors(self):
        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]
        r = client.post(
            "/api/v1/validate-pipeline",
            json={
                "fileId": file_id,
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "NonExistent", "operator": "equals", "value": 1}},
                ],
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is False
        assert len(data["errors"]) >= 1


class TestPreviewTransform:
    def test_preview_transform_returns_transformed_data(self):
        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]
        r = client.post(
            "/api/v1/preview-transform",
            json={
                "fileId": file_id,
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "A", "operator": "equals", "value": 1}},
                ],
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "columns" in data
        assert "rows" in data
        assert data["rowCountBefore"] >= 1
        assert data["rowCountAfter"] >= 0


class TestExportTransform:
    def test_export_transform_returns_excel_file(self):
        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]

        r = client.post(
            "/api/v1/export-transform",
            json={
                "fileId": file_id,
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "A", "operator": "equals", "value": 1}},
                ],
            },
        )
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert int(r.headers.get("content-length", "0")) >= 1


class TestBatchTransform:
    def test_batch_transform_individual_mode(self):
        # Upload two small files
        upload1 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test1.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        upload2 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test2.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload1.status_code == 200
        assert upload2.status_code == 200
        file_id_1 = upload1.json()["fileId"]
        file_id_2 = upload2.json()["fileId"]

        r = client.post(
            "/api/v1/batch-transform",
            json={
                "fileIds": [file_id_1, file_id_2],
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "A", "operator": "equals", "value": 1}},
                ],
                "outputFormat": "individual",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert len(data["results"]) == 2
        assert data.get("zipUrl") is None

    def test_batch_transform_zip_mode_and_download(self):
        # Upload two small files
        upload1 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test1.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        upload2 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test2.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload1.status_code == 200
        assert upload2.status_code == 200
        file_id_1 = upload1.json()["fileId"]
        file_id_2 = upload2.json()["fileId"]

        r = client.post(
            "/api/v1/batch-transform",
            json={
                "fileIds": [file_id_1, file_id_2],
                "sheetName": "Sheet1",
                "operations": [
                    {"type": "filter", "params": {"column": "A", "operator": "equals", "value": 1}},
                ],
                "outputFormat": "zip",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "results" in data
        assert len(data["results"]) == 2
        # New contract: zipId plus relative zipUrl
        assert data.get("zipId")
        assert data.get("zipUrl", "").startswith("/download-batch-zip")

        zip_id = data["zipId"]
        download = client.get(f"/api/v1/download-batch-zip?zipId={zip_id}")
        assert download.status_code == 200
        assert download.headers["content-type"] == "application/zip"


class TestMergeFiles:
    def test_merge_files_append_and_join(self):
        upload1 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("merge1.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        upload2 = client.post(
            "/api/v1/upload-excel",
            files={"file": ("merge2.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload1.status_code == 200
        assert upload2.status_code == 200
        file_id_1 = upload1.json()["fileId"]
        file_id_2 = upload2.json()["fileId"]

        # Append strategy
        r_append = client.post(
            "/api/v1/merge-files",
            json={
                "fileIds": [file_id_1, file_id_2],
                "strategy": "append",
            },
        )
        assert r_append.status_code == 200
        data_append = r_append.json()
        assert data_append["rowCount"] == 4  # 2 + 2 rows
        assert data_append["columnCount"] == 2

        # Join strategy on column A
        r_join = client.post(
            "/api/v1/merge-files",
            json={
                "fileIds": [file_id_1, file_id_2],
                "strategy": "join",
                "joinColumn": "A",
                "joinType": "inner",
            },
        )
        assert r_join.status_code == 200
        data_join = r_join.json()
        assert data_join["rowCount"] == 2
        assert data_join["columnCount"] >= 2


class TestAnalyzeData:
    def test_analyze_data_basic_happy_path(self):
        df = pd.DataFrame({"A": [1, 2, 3], "B": [4, 5, 6]})
        rows = df.to_dict(orient="records")

        r = client.post(
            "/api/v1/analyze-data",
            json={
                "columns": ["A", "B"],
                "rows": rows,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "insights" in data
        assert "visualizations" in data
        assert "summary" in data
        assert data["summary"]["total_rows"] == 3


class TestAIEndpoints:
    def test_ai_analyze_data_endpoint_happy_path(self, monkeypatch):
        # Mock AI output to avoid real OpenAI calls.
        def _mock_analyze_data(_df: pd.DataFrame, _user_profile: str = 'general') -> dict:
            return {
                "summary": "Mock summary",
                "insights": ["Mock insight 1", "Mock insight 2"],
                "data_quality_notes": ["Mock quality note"],
                "recommended_actions": ["Mock action"],
                "suggested_pipeline": [
                    {"type": "sort", "params": {"columns": [{"column": "A", "ascending": True}]}}
                ],
            }

        monkeypatch.setattr(ai_assistant, "analyze_data", _mock_analyze_data)

        upload = client.post(
            "/api/v1/upload-excel",
            files={"file": ("test.xlsx", _make_excel_bytes(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert upload.status_code == 200
        file_id = upload.json()["fileId"]

        r = client.post(
            "/api/v1/ai/analyze-data",
            json={"fileId": file_id, "sheetName": "Sheet1", "userProfile": "student"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "analysis" in data
        assert data["analysis"]["summary"] == "Mock summary"

    def test_ai_chat_endpoint_happy_path(self, monkeypatch):
        def _mock_chat(_message: str, _data_context: dict) -> str:
            return "Mock chat response"

        monkeypatch.setattr(ai_assistant, "chat", _mock_chat)

        r = client.post(
            "/api/v1/ai/chat",
            json={"message": "Hello", "dataContext": {"columns": ["A"], "rows": [{"A": 1}]}}
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["response"] == "Mock chat response"

    def test_ai_explain_endpoint_503_when_openai_not_configured(self, monkeypatch):
        def _mock_explain(_data_context: dict, _insight_type: str) -> str:
            raise OpenAIConfigError("OPENAI_API_KEY is not configured")

        monkeypatch.setattr(ai_assistant, "explain_insight", _mock_explain)

        r = client.post(
            "/api/v1/ai/explain-insight",
            json={"dataContext": {"columns": ["A"], "data": []}, "insightType": "kpi"},
        )
        assert r.status_code == 503
