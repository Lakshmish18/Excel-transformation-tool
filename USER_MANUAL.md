# Excel Data Transformation Tool — Complete User Manual

**Version:** 1.0  
**Date:** April 2026  
**Document type:** End-user guide  
**Audience:** Business users, analysts, students, and administrators who transform Excel/CSV data in a web browser without writing code.

> **Note:** Some labels, limits, or shortcuts may differ slightly by deployment or build. If anything disagrees with what you see, trust the live application and your administrator’s configuration.

---

## Table of contents

1. [Introduction](#1-introduction)  
2. [Getting started](#2-getting-started)  
3. [User profiles](#3-user-profiles)  
4. [Routes and navigation](#4-routes-and-navigation)  
5. [Home and dashboard](#5-home-and-dashboard)  
6. [Single-file workflow](#6-single-file-workflow)  
7. [Batch processing](#7-batch-processing)  
8. [Merging files](#8-merging-files)  
9. [Transformation operations](#9-transformation-operations)  
10. [AI assistant](#10-ai-assistant)  
11. [Data quality, KPIs, and profiling](#11-data-quality-kpis-and-profiling)  
12. [History, settings, and reuse](#12-history-settings-and-reuse)  
13. [Tips and best practices](#13-tips-and-best-practices)  
14. [Troubleshooting](#14-troubleshooting)  
15. [FAQ](#15-faq)  
16. [Appendix: roles and technical notes](#16-appendix-roles-and-technical-notes)  
17. [Quick start (one page)](#17-quick-start-one-page)

---

## 1. Introduction

The **Excel Data Transformation Tool** is a web application that lets you:

- Upload **Excel (`.xlsx`)** or **CSV (`.csv`)** files.
- **Preview** data in a table with header detection.
- Build a **transformation pipeline**: an ordered list of operations (filter, sort, replace, calculations, and more).
- **Run** the pipeline and inspect results before exporting.
- **Download** the transformed workbook as Excel.

Depending on your **user profile** and server configuration, you may also use **batch processing** (one pipeline on many files), **merge** multiple files, **KPIs and charts**, an **AI assistant**, optional **cloud history**, and **export to PDF** (where enabled).

You do **not** need Microsoft Excel installed to upload, preview, and download; you need a modern browser and a stable internet connection.

---

## 2. Getting started

1. Use a current version of **Chrome**, **Edge**, **Firefox**, or **Safari**.
2. Open the **application URL** your administrator gave you (for example `https://your-app.example.com`).
3. On first visit, choose a **user profile** if prompted (see [User profiles](#3-user-profiles)).
4. From **Home**, pick **Transform a single file**, **Batch processing**, or **Merge files**, or use the navigation after upload.

End users normally use only the **frontend** URL. You should not need the API address unless you are troubleshooting with IT.

---

## 3. User profiles

Your profile controls **which features appear** and your **maximum upload size** (in MB).

| Profile | Typical use | Max file size (MB) | Batch | Merge | Advanced ops | KPIs / Dashboard | AI / auto-analysis |
|--------|-------------|--------------------|-------|-------|--------------|------------------|---------------------|
| **Student / Learner** | Learning, assignments | 10 | No | Yes | No | No | No |
| **General User** | Everyday cleanup | 25 | No | Yes | No | Data quality & profiling only | No |
| **Business Analyst** | Reporting, KPIs | 50 | Yes | Yes | Yes | Yes | Yes |
| **Operations Manager** | Team workflows, batch | 50 | Yes | Yes | No* | Yes (no column profiling) | Yes |
| **Data Scientist** | Larger files, complex work | 100 | Yes | Yes | Yes | Yes | Yes |

\* When **advanced operations** are off for a profile, the **Add operation** list is limited to that profile’s **recommended** operations only (not the full catalog). **Business Analyst** and **Data Scientist** see all operations; **Student**, **General User**, and **Operations Manager** see restricted sets per product configuration.

You can change your profile later from **Settings** at **`/settings/profile`** when that route is available.

---

## 4. Routes and navigation

Typical URLs (paths are relative to your site root):

| Path | Purpose |
|------|---------|
| `/` | Home / landing |
| `/upload/single` | Upload one file for the standard flow |
| `/upload/batch` | Upload multiple files for batch |
| `/upload/merge` | Upload multiple files for merge |
| `/preview` | Sheet preview after single-file upload |
| `/pipeline` | Build and edit the operation pipeline |
| `/results` | Transformed preview and download |
| `/batch` | Batch pipeline and processing (after batch upload) |
| `/batch/results` | Batch results and download |
| `/merge` | Merge configuration (after merge upload) |
| `/merge/results` | Merged file result |
| `/dashboard` | Summary dashboard (when enabled for profile) |
| `/history` | Past runs (when cloud/history is enabled) |
| `/docs` | In-app documentation |
| `/settings/profile` | Profile and preferences |

The layout may show **breadcrumbs** and a **main menu** to move between sections when you have an active session or file context.

---

## 5. Home and dashboard

**Home** offers entry points:

- **Single-file transformation** — upload one workbook, then preview → pipeline → results.
- **Batch processing** — upload multiple files, share one pipeline, download a **ZIP** or handle **individual** outputs as offered.
- **Merge files** — combine files before or as a step toward further processing.

**Dashboard** (for profiles where it is enabled) summarizes activity and metrics relevant to your usage. Open it from navigation when visible.

---

## 6. Single-file workflow

### 6.1 Upload

1. Go to **`/upload/single`** (or use the Home card).
2. Drag a file into the drop zone or click to browse.
3. Only **`.xlsx`** and **`.csv`** are accepted. Files over your profile’s **size limit** are rejected with a clear message.

### 6.2 Preview

1. After upload, you are taken to **Preview** (`/preview`).
2. If the workbook has multiple sheets, select the correct **sheet**.
3. Review **Data Quality** and, if your profile allows, **KPIs**, **column profiling**, **trend charts**, and the **AI assistant** panel.

### 6.3 Pipeline

1. Open **Pipeline** (`/pipeline`).
2. Use **Add operation** to pick a **category**, then an **operation**, then configure parameters in the dialog.
3. Reorder, edit, or remove steps as needed.
4. Use **Validate** where available to check the pipeline against your data before a full run.
5. Run the pipeline (e.g. **Run** / **Apply**) and review the sample or full output as the UI indicates.

### 6.4 Results and download

1. Open **Results** (`/results`).
2. Check row counts and the preview table.
3. Use **Download** to save the transformed **Excel** file.

Large files or long pipelines may take time; keep the tab open until processing finishes.

---

## 7. Batch processing

**Purpose:** Apply the **same** pipeline to **multiple** files.

1. From Home, choose batch, or go to **`/upload/batch`** and upload several `.xlsx` / `.csv` files.
2. You are taken to **`/batch`** when files are present.
3. Enter the **sheet name** to use for **every** file. Each file should contain that sheet or that file may fail in the batch summary.
4. Build the **pipeline** (same concepts as single-file mode).
5. Choose **output format**: **ZIP** (one archive) or **individual** files, as shown in the UI.
6. Run **Process All Files** and, when complete, download from **`/batch/results`** or the completion panel.

**Tip:** If files have different columns, validate against the first file or simplify the pipeline so it applies safely to all.

---

## 8. Merging files

**Purpose:** Combine multiple Excel uploads into one dataset before you continue.

1. Go to **`/upload/merge`** and upload the files to combine.
2. On **`/merge`**, open **Merge configuration**.
3. Choose a **strategy**:
   - **Append rows** — stack rows vertically; files should share the same columns.
   - **Join by column** — SQL-like join; specify the **join column** and **join type** (inner, left, right, outer).
   - **Union** — combine columns across files (union of columns).
4. Run **Merge** and review results on **`/merge/results`**. You may then continue to preview/pipeline depending on the app flow.

---

## 9. Transformation operations

Operations are grouped in the **Add operation** dialog as follows.

### Data cleaning

| Operation | Summary |
|-----------|---------|
| **Filter rows** | Keep rows matching conditions |
| **Remove duplicates** | Drop duplicate rows (optionally by selected columns) |
| **Remove blank rows** | Remove rows with empty cells in chosen columns |
| **Text cleanup** | Trim, case, remove special characters |
| **Select columns** | Keep only specified columns |

### Transformation

| Operation | Summary |
|-----------|---------|
| **Find & replace** | Replace text in a column |
| **Math operations** | Add, subtract, multiply, divide between columns or with constants |
| **Convert to number** | Parse text as numeric values |
| **Sort** | Order by one or more columns |
| **Split column** | Split text using a delimiter |
| **Merge columns** | Combine multiple columns into one |

### Financial

| Operation | Summary |
|-----------|---------|
| **Gross profit** | Revenue minus cost of goods sold |
| **Net profit** | Gross profit minus expenses |
| **P&L statement** | Period-based profit and loss style summary |

### Advanced

| Operation | Summary |
|-----------|---------|
| **Aggregate** | Group and summarize (sum, average, count, etc.) |
| **Date format** | Convert between date formats |

Help tooltips in the app mirror short **guidance per operation**. If your profile does not enable the **full** operation set, only **recommended** operations for that profile appear in each category (see [User profiles](#3-user-profiles)).

---

## 10. AI assistant

If your profile includes **AI / auto-analysis**, you may see an **AI Assistant** on Preview, Batch, or related screens.

Typical capabilities (when the server is configured with API access and quota):

- Summaries or insights about the current sheet.
- Suggested next steps or pipeline ideas (where implemented).
- Chat-style questions about the data in plain language.

If the assistant returns errors, timeouts, or “unavailable,” the cause is usually **server configuration or quota**, not your spreadsheet. Retry later or contact your administrator. Sensitive data policies still apply—only send data you are allowed to process on this system.

---

## 11. Data quality, KPIs, and profiling

- **Data quality** highlights missing values, inconsistencies, and similar issues on the preview.
- **KPI cards** (profiles that enable them) show aggregates such as sums and averages for numeric columns.
- **Column profiling** summarizes distributions and null rates per column.
- **Trend charts** may appear when enabled for your profile.

These views are **analytical** until you add operations to the pipeline; they do not change the file by themselves.

---

## 12. History, settings, and reuse

- **Pipeline reuse:** Save or export pipeline definitions when the UI offers **save/load** or JSON export (behavior depends on build).
- **History** (`/history`): appears when cloud or local history features are enabled; use it to revisit past transformations.
- **Settings** (`/settings/profile`): change **profile** and review feature toggles implied by that profile.
- **Export to PDF** is available only for profiles that enable it.

Clearing **browser site data** may remove unsaved local drafts—keep copies of important pipeline definitions offline if needed.

---

## 13. Tips and best practices

- Start with **Filter** and **Select columns** to reduce noise before heavy steps.
- Use **Validate** before long runs on big files.
- For batch jobs, use a **consistent sheet name** and similar schemas across files.
- For merges, confirm **column names** match your join key exactly (case/spacing).
- Prefer **UTF-8** CSV files for predictable encoding.

---

## 14. Troubleshooting

| Symptom | What to try |
|--------|-------------|
| Rejected upload | Confirm `.xlsx` or `.csv`, size under profile limit, file not corrupt; CSV UTF-8. |
| Wrong sheet | Select the correct tab on Preview before building the pipeline. |
| Timeout / slow | Smaller file, fewer steps, or retry; keep the tab active. |
| Merge / join error | Check strategy, join column name, and join type; verify columns exist in all files for joins. |
| Batch partial failures | Inspect per-file messages; fix schema or sheet name mismatches. |
| AI errors | Retry; confirm with admin that AI keys and quotas are configured. |
| Connection / CORS errors | Usually deployment or URL mismatch—contact administrator with time and browser **Network** details. |

---

## 15. FAQ

**Do I need Excel on my PC?**  
No. The app runs in the browser; Excel is only needed if you want to open the downloaded file locally.

**Can I use password-protected workbooks?**  
Typically no—upload usually requires an unprotected file the server can read.

**Where is my data stored?**  
Depends on deployment: processing may be ephemeral. Optional cloud features may store metadata or files per your organization’s setup.

**Can I automate this without the UI?**  
This manual covers the web UI. API access is a separate topic for administrators and developers.

---

## 16. Appendix: roles and technical notes

| Role | Responsibility |
|------|----------------|
| **End user** | Uses authorized data only; follows organizational policies. |
| **Administrator** | Hosts the app, configures origins, file limits, optional Supabase/auth, and API keys; monitors quotas and incidents. |

| Topic | Detail |
|-------|--------|
| **Client** | Single-page application; production should use **HTTPS**. |
| **Formats** | `.xlsx`, `.csv` (UTF-8 recommended for CSV). |
| **Stack (typical)** | React frontend, FastAPI backend; optional Supabase for storage/auth. |
| **Limits** | Per-profile upload size; server timeouts on large exports. |
| **Security** | API keys belong in **server** environment variables, never in the browser. |

---

## 17. Quick start (one page)

1. Open your app URL → choose a **profile** if asked.  
2. **Home** → **Transform a single file** → upload `.xlsx` or `.csv`.  
3. **Preview** → pick the **sheet** → review data quality (and KPIs if shown).  
4. **Pipeline** → **Add operation** → build steps → **validate** → **run**.  
5. **Results** → **download** Excel.  
6. For many files: **Batch** from Home → upload → same pipeline → **ZIP** or individual download.  
7. To combine files first: **Merge** → upload → choose **append**, **join**, or **union** → merge → continue as guided.

---

*Document control: this manual describes the intended product behavior for a standard deployment. Your organization may enable or disable features; follow internal guidance when it differs from this document.*
