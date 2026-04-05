# Supabase Database Setup Guide

This guide will help you set up Supabase for storing transformation history, saved pipelines, and file storage.

## Prerequisites

1. A Supabase account (free tier is sufficient)
2. Node.js and npm installed
3. The project dependencies installed (`npm install`)

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in:
   - **Name**: Excel Transformation Tool (or your choice)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to you
5. Click "Create new project"
6. Wait 2-3 minutes for project to initialize

## Step 2: Get API Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ...`)

## Step 3: Set Environment Variables

1. In `frontend/` directory, copy `.env.example` to `.env`:
   ```bash
   cd frontend
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

3. **Important**: Restart your development server after adding `.env` file

## Step 4: Create Database Tables

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy and paste the entire contents of `database/schema.sql`
4. Click "Run" (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 5: Create Storage Bucket

1. In Supabase dashboard, go to **Storage**
2. Click "Create bucket"
3. Fill in:
   - **Name**: `transformed-files`
   - **Public bucket**: **Unchecked** (private)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
4. Click "Create bucket"

## Step 6: Set Storage Policies (Optional but Recommended)

1. Go to **Storage** → **Policies** → `transformed-files`
2. Click "New Policy"
3. Select "For full customization"
4. Add these policies:

**Policy 1: Users can upload their own files**
```sql
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'transformed-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Policy 2: Users can view their own files**
```sql
CREATE POLICY "Users can view own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'transformed-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

**Policy 3: Users can delete their own files**
```sql
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'transformed-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Step 7: Verify Setup

1. Restart your development server:
   ```bash
   npm start
   ```

2. Open the app in browser
3. Try signing up/signing in (if Auth component is added)
4. Save a pipeline - it should save to Supabase
5. Transform a file - history should be saved
6. Check Supabase dashboard:
   - **Table Editor** → `saved_pipelines` - should see your pipeline
   - **Table Editor** → `transformation_history` - should see history records
   - **Storage** → `transformed-files` - should see uploaded files

## Troubleshooting

### "Supabase not configured" warning
- Check that `.env` file exists in `frontend/` directory
- Verify environment variable names are correct (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Restart development server after adding `.env`

### "Failed to save pipeline"
- Check browser console for errors
- Verify database tables exist (run `schema.sql` again)
- Check RLS policies are enabled

### "Failed to upload file"
- Verify storage bucket exists and is named `transformed-files`
- Check storage policies allow uploads
- Verify file size is under 50MB

### Authentication not working
- Check that email confirmation is disabled (for testing) in Supabase:
  - Go to **Authentication** → **Settings**
  - Disable "Enable email confirmations" (for development)
- Or check your email for confirmation link

## Features Enabled with Supabase

✅ **Cloud Storage**: Pipelines saved to database (not just localStorage)
✅ **Transformation History**: All transformations tracked with metadata
✅ **File Storage**: Transformed files stored in Supabase Storage
✅ **Multi-device Access**: Access your pipelines from any device
✅ **User Isolation**: Each user only sees their own data (RLS)

## Fallback Behavior

If Supabase is not configured, the app will:
- Use localStorage for pipelines (local only)
- Skip saving transformation history
- Skip uploading files to cloud storage
- Still work fully for transformations

This ensures the app works even without Supabase setup.

## Next Steps

- Add authentication UI to your app (see `components/Auth.tsx`)
- Add "History" link to navigation (see `pages/HistoryPage.tsx`)
- Customize storage policies for your needs
- Set up email templates in Supabase for better UX
