# Deployment Guide

Deploy the Excel Data Transformation Tool to production: **frontend on Vercel**, **backend on Railway** (or **backend on Vercel** using `backend/vercel.json`).

---

## Prerequisites

- GitHub repository with your code pushed
- Accounts: [Vercel](https://vercel.com) and [Railway](https://railway.app)

---

## Step 1: Backend (Railway)

### 1.1 Create project

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your repository
5. Railway will detect Python and use `backend/` (see Root Directory below)

### 1.2 Configure root directory

- In your service → **Settings** → **Root Directory**: set to `backend`
- Railway will use `backend/` as the project root

### 1.3 Environment variables

In **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `MAX_FILE_SIZE` | `52428800` |
| `ALLOWED_ORIGINS` | `https://placeholder.vercel.app` *(update after frontend deploys)* |
| `PORT` | `8000` |

*Railway sets `PORT` automatically; you can omit it.*

### 1.4 Deploy

- Railway deploys automatically on push
- Or click **Deploy** to trigger manually

### 1.5 Get backend URL

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Copy the public URL, e.g. `https://excel-tool-production.up.railway.app`
3. The API base is: `https://your-app.up.railway.app/api/v1`

### Alternative: backend on Vercel

If you prefer the API on Vercel instead of Railway:

1. In Vercel → **Add New** → **Project** → import the same GitHub repo.
2. **Root Directory:** `backend` (the repo includes `backend/vercel.json` for Python serverless).
3. **Environment variables:** same ideas as Railway — at minimum `ALLOWED_ORIGINS`, `MAX_FILE_SIZE` (e.g. `52428800`), and optionally `OPENAI_API_KEY` if you use the AI assistant.
4. Deploy and copy the project URL. Your frontend **`VITE_API_URL`** must be the **API base including `/api/v1`**, e.g. `https://your-backend.vercel.app/api/v1`.
5. Update **`ALLOWED_ORIGINS`** on the backend to your exact Vercel frontend URL(s), comma-separated with no spaces.

---

## Step 2: Frontend (Vercel)

### 2.1 Import project

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub
2. Click **Add New...** → **Project**
3. Import your repository

### 2.2 Configure build

- **Framework Preset:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 2.3 Environment variables

Add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://YOUR-RAILWAY-URL.up.railway.app/api/v1` |

*(Replace with your actual Railway URL from Step 1.5. No trailing slash.)*

### 2.4 Deploy

- Click **Deploy**
- Wait for the build to complete

### 2.5 Get frontend URL

- Copy the production URL, e.g. `https://excel-tool.vercel.app`

---

## Step 3: Update CORS

1. Go back to **Railway** → your service → **Variables**
2. Update `ALLOWED_ORIGINS`:

   ```
   https://excel-tool.vercel.app,https://excel-tool-xxx.vercel.app
   ```

   *(Use your actual Vercel URL(s). Comma-separated, no spaces after commas.)*

3. Railway will redeploy automatically

---

## Step 4: Verify deployment

1. Open your **Vercel URL** in a browser
2. Run the full flow:
   - Upload an `.xlsx` file
   - Add operations (filter, sort, etc.)
   - Run & preview
   - Download the transformed file
3. Check browser console for errors
4. Test error cases:
   - Upload `.txt` → should reject
   - Upload file > 50MB → should show "File too large"

---

## Troubleshooting

### Railway

- **Build fails:** Check `requirements.txt` and `railway.json`
- **Port error:** Ensure start command uses `$PORT`
- **Logs:** Railway dashboard → Deployments → View Logs

### Vercel

- **Build fails:** Check `npm run build` locally
- **404 on refresh:** `vercel.json` rewrites should route `/*` to `index.html`
- **API errors:** Verify `VITE_API_URL` points to Railway and includes `/api/v1`

### CORS

- If the frontend can’t reach the backend:
  - `ALLOWED_ORIGINS` must match the Vercel URL exactly (including `https://`)
  - No trailing slash
  - Multiple origins: comma-separated

---

## Optional: Supabase

For cloud save and auth:

1. Add to **Vercel** env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. In Supabase dashboard → Auth → URL configuration:
   - Add your Vercel URL to **Site URL** and **Redirect URLs**
