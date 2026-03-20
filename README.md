# Excel Data Transformation Tool

A full-stack web application that lets you **upload Excel files**, **preview data**, **build transformation pipelines** (17+ operations), and **download results**—without writing code or formulas. Includes batch processing, file merging, cloud save (Supabase), and an in-app product tour.

**Repository:** [https://github.com/Lakshmish18/Excel-transformation-tool](https://github.com/Lakshmish18/Excel-transformation-tool)

---

## Features

- **Upload & preview** – Drag-and-drop `.xlsx` (up to 50MB), automatic header detection, data quality insights
- **17 transformation operations** – Filter, Find & Replace, Math, Sort, Select Columns, Remove Duplicates, Remove Blank Rows, Text Cleanup, Convert to Number, Split Column, Merge Columns, Date Format, Gross/Net Profit, P&L, Aggregate
- **Visual pipeline builder** – Add, reorder, edit, validate, and run multi-step pipelines with real-time validation
- **Results & download** – Preview transformed data, then download as Excel; undo/redo and save pipelines
- **Batch processing** – Apply the same pipeline to many files; download as ZIP
- **Merge files** – Append, join, or union multiple Excel files
- **Transformation history** – View and replay past runs (with Supabase)
- **Cloud save & auth** – Save/load pipelines and optional file storage via Supabase (optional; works with localStorage only)
- **Product tour & docs** – First-time product tour and built-in documentation at `/docs`

---

## Tech Stack

| Layer    | Technologies |
|----------|--------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Axios, Supabase JS |
| Backend  | Python 3.11+, FastAPI, pandas, openpyxl, uvicorn |
| Optional | Supabase (Auth, PostgreSQL, Storage) |

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.9+ (3.11 recommended)

---

## How to Run the Project

### 1. Clone the repository

```bash
git clone https://github.com/Lakshmish18/Excel-transformation-tool.git
cd Excel-transformation-tool
```

### 2. Backend setup (first time only)

```bash
cd backend
python -m venv venv
```

**Activate the virtual environment:**

- **Windows (PowerShell):**
  ```powershell
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt):**
  ```cmd
  venv\Scripts\activate.bat
  ```
- **Linux / macOS:**
  ```bash
  source venv/bin/activate
  ```

**Install dependencies and run:**

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Leave this terminal open. The API runs at **http://localhost:8000** (docs at http://localhost:8000/docs).

### 3. Frontend setup (new terminal)

Open a **second** terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Leave this terminal open. The app runs at **http://localhost:5173**.

### 4. Open the app

In your browser go to: **http://localhost:5173**

---

## One-command run (from project root)

After backend venv and frontend dependencies are installed once:

```bash
npm install
npm start
```

Then open **http://localhost:5173**. This starts both backend and frontend in one terminal. If the process exits immediately (e.g. on some Windows setups), use the **manual run** below.

---

## Manual run (two terminals)

**Terminal 1 – Backend:**

```bash
cd backend
.\venv\Scripts\Activate.ps1    # Windows PowerShell; on Mac/Linux: source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 – Frontend:**

```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173**.

---

## Windows: run in separate windows and open browser

From project root (PowerShell):

```powershell
.\scripts\run-browser.ps1
```

This starts the backend and frontend in two new windows and opens http://localhost:5173 in your browser.

---

## Environment variables (optional)

The app runs without any `.env` file. Optional configuration:

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_SUPABASE_URL` | frontend `.env` | Supabase project URL (auth, cloud pipelines, history) |
| `VITE_SUPABASE_ANON_KEY` | frontend `.env` | Supabase anon/public key |
| `VITE_API_URL` | frontend (production) | Backend API URL when deploying (e.g. Vercel) |
| `ALLOWED_ORIGINS` | backend (production) | CORS allowed origins when deploying (e.g. Render) |

Copy `frontend/.env.example` to `frontend/.env` and fill in Supabase values if you use cloud features. For local dev, the frontend uses `/api/v1` with a proxy to `localhost:8000`.

---

## Project structure

```
Excel-transformation-tool/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # API routes (health, excel, transform, merge, analyze)
│   │   ├── models/          # Pydantic operation models
│   │   ├── utils/           # Excel loader, file cleanup
│   │   ├── transform_engine.py
│   │   └── main.py          # FastAPI app, CORS
│   ├── requirements.txt
│   ├── railway.json         # Railway deployment config
│   ├── Procfile             # Process command for Railway
│   └── uploads/             # Temporary uploads (gitignored)
├── frontend/
│   ├── src/
│   │   ├── components/     # UI, PipelineBuilder, ProductTour, Auth, etc.
│   │   ├── pages/           # Landing, Upload, Preview, Pipeline, Results, Docs, etc.
│   │   ├── lib/             # api.ts, supabase, storage
│   │   └── context/
│   ├── package.json
│   ├── vite.config.ts       # Proxy /api to backend in dev
│   └── vercel.json          # SPA rewrites for deploy
├── scripts/
│   ├── start-backend.js     # Used by npm start
│   └── run-browser.ps1       # Windows: start both + open browser
├── DEPLOYMENT.md            # Deploy to Vercel + Railway
└── README.md                # This file
```

---

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| POST | `/api/v1/upload-excel` | Upload Excel file |
| GET | `/api/v1/preview-sheet` | Preview sheet rows |
| POST | `/api/v1/preview-transform` | Apply pipeline and return preview |
| POST | `/api/v1/validate-pipeline` | Validate pipeline without applying |
| POST | `/api/v1/export-transform` | Apply and return Excel file |
| POST | `/api/v1/upload-multiple-excel` | Upload multiple files |
| POST | `/api/v1/merge-files` | Merge files (append/join/union) |
| POST | `/api/v1/batch-transform` | Batch transform, return ZIP |
| POST | `/api/v1/analyze-data` | Data quality insights and chart suggestions |

Interactive API docs when backend is running: **http://localhost:8000/docs**

---

## Deployment

To deploy the app (frontend on Vercel, backend on Railway), follow **[DEPLOYMENT.md](DEPLOYMENT.md)**. It covers:

1. Deploying the backend on Railway  
2. Deploying the frontend on Vercel  
3. Setting CORS (`ALLOWED_ORIGINS`) and optional Supabase redirect URLs  
4. Verifying the live app  

---

## Testing the flow locally

1. Open http://localhost:5173  
2. Click **Get Started** or **Transform Single File**  
3. Upload an `.xlsx` file  
4. Select a sheet and review the preview  
5. Go to **Pipeline**, add operations (e.g. Filter, Math, Sort), then **Validate** and **Run & Preview**  
6. On **Results**, preview and **Download Transformed File**  
7. Try **Batch Process** or **Merge Files** from the home page  
8. Use **Help → Product Tour** or **Documentation** for more guidance  

---

## License

This project is for educational and demonstration purposes.

---

**Version:** 1.0.0
