/**
 * Supabase client configuration for database and storage.
 * Only creates the client when env vars are set so the app does not crash without .env.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials not found. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file'
  )
}

/** Only created when credentials exist; null otherwise so the app runs without .env */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null

// Types
export interface User {
  id: string
  email: string
  created_at: string
}

export interface SavedPipeline {
  id: string
  user_id: string
  name: string
  description?: string
  operations: import('@/lib/api').Operation[]
  created_at: string
  updated_at: string
}

export interface TransformationHistory {
  id: string
  user_id: string
  file_name: string
  original_file_url?: string
  transformed_file_url?: string
  pipeline_id?: string
  operations: import('@/lib/api').Operation[]
  row_count_before?: number
  row_count_after?: number
  status: 'success' | 'failed'
  error_message?: string
  created_at: string
}

/**
 * Get current user ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (!supabase) return null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabase != null
}
