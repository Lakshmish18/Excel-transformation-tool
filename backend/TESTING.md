# Backend API Testing Guide

## Endpoints

### 1. POST /api/v1/upload-excel

Upload an Excel file and get file ID and sheet names.

**Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/upload-excel" \
  -F "file=@path/to/your/file.xlsx"
```

**Response:**
```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "fileName": "example.xlsx",
  "sheets": ["Sheet1", "Sheet2", "Data"]
}
```

**Error Responses:**
- `400`: Invalid file type (not .xlsx)
- `400`: Error reading Excel file
- `500`: Server error processing file

---

### 2. GET /api/v1/preview-sheet

Preview rows from a specific sheet.

**Request:**
```bash
curl "http://localhost:8000/api/v1/preview-sheet?fileId=550e8400-e29b-41d4-a716-446655440000&sheetName=Sheet1&limit=10"
```

**Query Parameters:**
- `fileId` (required): File ID from upload endpoint
- `sheetName` (required): Name of the sheet to preview
- `limit` (optional): Number of rows to return (default: 10, max: 50)

**Response:**
```json
{
  "fileId": "550e8400-e29b-41d4-a716-446655440000",
  "sheetName": "Sheet1",
  "columns": ["Name", "Age", "City"],
  "rows": [
    {
      "Name": "John",
      "Age": 30,
      "City": "New York"
    },
    {
      "Name": "Jane",
      "Age": 25,
      "City": "London"
    }
  ]
}
```

**Error Responses:**
- `404`: File not found (invalid fileId)
- `400`: Sheet not found (invalid sheetName)
- `500`: Error reading sheet

---

## Testing with Python

```python
import requests

# 1. Upload a file
with open("test.xlsx", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/v1/upload-excel",
        files={"file": f}
    )
    data = response.json()
    print(f"File ID: {data['fileId']}")
    print(f"Sheets: {data['sheets']}")
    file_id = data['fileId']

# 2. Preview a sheet
response = requests.get(
    "http://localhost:8000/api/v1/preview-sheet",
    params={
        "fileId": file_id,
        "sheetName": "Sheet1",
        "limit": 10
    }
)
preview = response.json()
print(f"Columns: {preview['columns']}")
print(f"Rows: {len(preview['rows'])}")
for row in preview['rows']:
    print(row)
```

---

## Testing with Swagger UI

1. Start the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

2. Open browser: `http://localhost:8000/docs`

3. Use the interactive API documentation to test endpoints:
   - Click on `POST /api/v1/upload-excel`
   - Click "Try it out"
   - Upload a file
   - Click "Execute"
   - Copy the `fileId` from response

4. Test preview:
   - Click on `GET /api/v1/preview-sheet`
   - Click "Try it out"
   - Enter the `fileId` and `sheetName`
   - Set `limit` (optional)
   - Click "Execute"

---

## Error Handling Examples

### Invalid File Type
```bash
curl -X POST "http://localhost:8000/api/v1/upload-excel" \
  -F "file=@document.pdf"
```
Response: `400 - Invalid file type. Only .xlsx files are supported.`

### File Not Found
```bash
curl "http://localhost:8000/api/v1/preview-sheet?fileId=invalid-id&sheetName=Sheet1"
```
Response: `404 - File with ID 'invalid-id' not found. Please upload the file first.`

### Sheet Not Found
```bash
curl "http://localhost:8000/api/v1/preview-sheet?fileId=valid-id&sheetName=NonExistentSheet"
```
Response: `400 - Sheet 'NonExistentSheet' not found. Available sheets: Sheet1, Sheet2`

