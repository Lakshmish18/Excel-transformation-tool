import type { UploadResponse } from '@/lib/api'

/** Sheet names that exist in every uploaded file (required for batch processing). */
export function sheetsCommonToAllFiles(files: UploadResponse[]): string[] {
  if (files.length === 0) return []
  return files[0].sheets.filter((name) => files.every((f) => f.sheets.includes(name)))
}
