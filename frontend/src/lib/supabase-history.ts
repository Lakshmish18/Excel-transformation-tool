/**
 * Supabase functions for transformation history
 */
import { supabase, type TransformationHistory, getCurrentUserId, isSupabaseConfigured } from './supabase'
import { logger } from './logger'
import { toast } from 'sonner'
import type { Operation } from './api'

/**
 * Save transformation history to Supabase
 */
export async function saveTransformationHistory(
  fileName: string,
  operations: Operation[],
  rowCountBefore?: number,
  rowCountAfter?: number,
  originalFileUrl?: string,
  transformedFileUrl?: string,
  pipelineId?: string,
  status: 'success' | 'failed' = 'success',
  errorMessage?: string
): Promise<TransformationHistory | null> {
  // Skip if Supabase not configured
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, skipping history save')
    return null
  }

  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      // Not signed in, skip saving history
      logger.debug('User not signed in, skipping history save')
      return null
    }

    const { data, error } = await supabase
      .from('transformation_history')
      .insert([
        {
          user_id: userId,
          file_name: fileName,
          original_file_url: originalFileUrl,
          transformed_file_url: transformedFileUrl,
          pipeline_id: pipelineId,
          operations,
          row_count_before: rowCountBefore,
          row_count_after: rowCountAfter,
          status,
          error_message: errorMessage,
        },
      ])
      .select()
      .single()

    if (error) {
      logger.error('Save history error:', error)
      // Don't show error toast - history is non-critical
      return null
    }

    return data
  } catch (error) {
    logger.error('Save history exception:', error)
    return null
  }
}

/**
 * Load transformation history from Supabase
 */
export async function loadTransformationHistory(limit: number = 50): Promise<TransformationHistory[]> {
  // Return empty if Supabase not configured
  if (!isSupabaseConfigured() || !supabase) {
    return []
  }

  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return []
    }

    const { data, error } = await supabase
      .from('transformation_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      logger.error('Load history error:', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Load history exception:', error)
    return []
  }
}

/**
 * Delete transformation history record
 */
export async function deleteTransformationHistory(historyId: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false
  }

  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return false
    }

    const { error } = await supabase
      .from('transformation_history')
      .delete()
      .eq('id', historyId)
      .eq('user_id', userId)

    if (error) {
      logger.error('Delete history error:', error)
      toast.error('Failed to delete history record')
      return false
    }

    toast.success('History record deleted')
    return true
  } catch (error) {
    logger.error('Delete history exception:', error)
    return false
  }
}
