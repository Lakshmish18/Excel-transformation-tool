/**
 * Shared type definitions for the Excel Data Transformation Tool
 */
import type { Operation } from '@/lib/api'

export type { Operation }

export interface FilterParams {
  column: string
  operator: string
  value: string | number
}

export interface MathParams {
  operation: 'add' | 'subtract' | 'multiply' | 'divide'
  columnA: string
  columnB?: string
  value?: number
  newColumn: string
}

export interface SortColumnParam {
  column: string
  ascending: boolean
}

export interface TransformResult {
  columns: string[]
  rows: Record<string, unknown>[]
  totalRows: number
  metadata?: {
    fileId: string
    sheetName: string
    operations: Operation[]
  }
}

export interface APIError {
  detail: string
  status?: number
}

export interface UploadResponse {
  fileId: string
  fileName: string
  sheets: string[]
}

export interface SavedPipeline {
  id: string
  user_id: string
  name: string
  description?: string
  operations: Operation[]
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
  operations: Operation[]
  row_count_before?: number
  row_count_after?: number
  status: 'success' | 'failed'
  error_message?: string
  created_at: string
}
