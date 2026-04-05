# Excel Data Transformation Tool — Project briefing

This document is the **high-level briefing** for the repository: what the product does, how it is built, how it is deployed, and where to find deeper documentation.

**Repository:** [https://github.com/Lakshmish18/Excel-transformation-tool](https://github.com/Lakshmish18/Excel-transformation-tool)

---

## 1. Purpose

A **browser-based** tool for analysts and teams who need to **clean, reshape, and analyze spreadsheet data** without writing formulas or scripts. Users upload Excel (`.xlsx`) or CSV, preview data, compose a **visual pipeline** of operations, run previews, then **export** transformed workbooks. Optional features include **batch runs across many files**, **merging** multiple files, **cloud-backed** history and saved pipelines (Supabase), and an **AI assistant** when the backend is configured with an OpenAI API key.

---

## 2. Core capabilities

| Area | What users get |
|------|----------------|
| **Single-file flow** | Upload → sheet preview → build pipeline → preview transform → download Excel |
| **Operations** | 17+ steps: filter, find/replace, math, sort, column selection, dedupe, blanks, text cleanup, type conversion, split/merge columns, dates, financial helpers, aggregates, and more |
| **Batch** | Same pipeline applied to multiple uploads; ZIP download |
| **Merge** | Append, join, or union multiple Excel sources |
| **Quality & insights** | Rule-based analysis and suggestions for charts/KPIs (profile-dependent) |
| **Persistence** | Local browser storage by default; optional Supabase for auth, saved pipelines, history, and file storage |
| **AI assistant** | Natural-language help building pipelines (requires `OPENAI_API_KEY` on the server) |

---

## 3. Architecture (short)

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui. Calls REST APIs under `/api/v1`. In development, Vite proxies `/api` to the local FastAPI server; in production, `VITE_API_URL` points at the deployed API base (including `/api/v1`).
- **Backend:** FastAPI, pandas, openpyxl. Uploads and exports use server-side storage paths (local `uploads/` / `outputs/` or `/tmp` on serverless hosts). In-memory `fileStorage` maps upload IDs to paths.
- **Optional:** Supabase (PostgreSQL, Auth, Storage), OpenAI (assistant only).

For **sequence diagrams, route mapping, and data flow**, see **[WORKFLOW_AND_ARCHITECTURE.md](WORKFLOW_AND_ARCHITECTURE.md)**.

---

## 4. Technology stack

| Layer | Technologies |
|--------|----------------|
| UI | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router, Axios |
| API client | Shared `api.ts`, optional Supabase JS |
| API server | Python 3.11+, FastAPI, Uvicorn, pandas, openpyxl |
| Deploy | Common pattern: frontend on **Vercel**; backend on **Railway** or **Vercel** (see below) |

---

## 5. Repository layout (conceptual)

```
backend/app/          # FastAPI app, routers (excel, transform, merge, ai, …)
backend/app/models/   # Pydantic models for operations
backend/app/utils/    # Excel IO, storage helpers
frontend/src/         # Pages, components, contexts, lib (api, supabase)
scripts/              # Dev helpers (e.g. start scripts, demo file generation)
demo/                 # Optional demo/sample assets (if present)
```

---

## 6. Configuration and secrets

| Variable | Scope | Role |
|----------|--------|------|
| `VITE_API_URL` | Frontend (build) | Production API base URL, e.g. `https://api.example.com/api/v1` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend | Optional cloud auth, pipelines, history |
| `ALLOWED_ORIGINS` | Backend | CORS: comma-separated frontend origins (no spaces) |
| `MAX_FILE_SIZE` | Backend | Upload limit in bytes (e.g. `52428800` for 50MB) |
| `OPENAI_API_KEY` | Backend | Optional; enables AI assistant routes |
| Supabase service role / DB URL | Backend | If using server-side Supabase features (see `SUPABASE_SETUP.md`) |

Copy **`frontend/.env.example`** when creating local `frontend/.env`. Never commit real secrets.

---

## 7. API surface (summary)

Interactive docs when the backend runs: **`/docs`** (Swagger UI).

Typical groups:

- **Health:** `GET /api/v1/health`
- **Excel:** upload, preview, download helpers
- **Transform:** validate pipeline, preview, export, batch (and ZIP)
- **Merge:** combine multiple files
- **Analyze:** data-quality / insight endpoints
- **AI:** assistant endpoints when OpenAI is configured

Exact paths are listed in **[README.md](README.md)** and implemented under `backend/app/api/v1/`.

---

## 8. Deployment

- **Step-by-step guide:** **[DEPLOYMENT.md](DEPLOYMENT.md)** — Vercel frontend + Railway backend, CORS, and verification.
- **Backend on Vercel:** The repo includes **`backend/vercel.json`** for serverless Python; create a separate Vercel project with **root directory `backend`**, set the same env vars as on any host (`ALLOWED_ORIGINS`, `MAX_FILE_SIZE`, optional `OPENAI_API_KEY`), then set **`VITE_API_URL`** on the frontend project to that deployment’s **`…/api/v1`** base URL.
- **Updating production:** Push to **`main`** on GitHub. If Vercel/Railway projects are **connected to the repo**, they **redeploy automatically**. Otherwise trigger a deploy from each provider’s dashboard.

---

## 9. Documentation index

| Document | Audience |
|----------|----------|
| **[README.md](README.md)** | Quick start, structure, env overview, API table |
| **[USER_MANUAL.md](USER_MANUAL.md)** | End-user guide: flows, operations, troubleshooting |
| **[WORKFLOW_AND_ARCHITECTURE.md](WORKFLOW_AND_ARCHITECTURE.md)** | Technical workflow and architecture diagrams |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Production deployment (Vercel + Railway) |
| **[SUPABASE_SETUP.md](SUPABASE_SETUP.md)** | Optional Supabase database and client setup |
| **backend/README.md**, **frontend/README.md** | Package-specific notes if present |

---

## 10. License and version

Educational and demonstration use unless you apply a different license in your fork.

**Version:** 1.0.0 (see **README.md** for current feature list).
