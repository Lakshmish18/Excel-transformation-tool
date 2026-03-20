/**
 * Supabase Storage functions for file uploads
 */
import { supabase, getCurrentUserId, isSupabaseConfigured } from './supabase'
import { logger } from './logger'
import { toast } from 'sonner'

const STORAGE_BUCKET = 'transformed-files'

/**
 * Upload transformed file to Supabase Storage
 */
export async function uploadTransformedFile(
  file: Blob,
  fileName: string
): Promise<string | null> {
  if (!isSupabaseConfigured() || !supabase) {
    logger.debug('Supabase not configured, skipping file upload')
    return null
  }

  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      logger.debug('User not signed in, skipping file upload')
      return null
    }

    // Create file path: userId/timestamp_filename.xlsx
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })

    if (error) {
      logger.error('Upload error:', error)
      // Don't show error toast - file upload is optional
      return null
    }

    // Get public URL (or signed URL for private buckets)
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return urlData.publicUrl
  } catch (error) {
    logger.error('Upload exception:', error)
    return null
  }
}

/**
 * Download file from Supabase Storage
 */
export async function downloadFile(fileUrl: string, fileName: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    toast.error('File storage not configured')
    return false
  }

  try {
    // Extract file path from URL
    const url = new URL(fileUrl)
    const filePath = url.pathname.split(`${STORAGE_BUCKET}/`)[1]

    if (!filePath) {
      toast.error('Invalid file URL')
      return false
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(filePath)

    if (error) {
      logger.error('Download error:', error)
      toast.error('Failed to download file: ' + error.message)
      return false
    }

    // Trigger browser download
    const blobUrl = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)

    return true
  } catch (error) {
    logger.error('Download exception:', error)
    toast.error('Failed to download file')
    return false
  }
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(fileUrl: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false
  }

  try {
    const url = new URL(fileUrl)
    const filePath = url.pathname.split(`${STORAGE_BUCKET}/`)[1]

    if (!filePath) {
      return false
    }

    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath])

    if (error) {
      logger.error('Delete file error:', error)
      return false
    }

    return true
  } catch (error) {
    logger.error('Delete file exception:', error)
    return false
  }
}
