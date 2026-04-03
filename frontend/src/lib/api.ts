/**
 * API client for backend communication
 */
import axios from 'axios'
import { toast } from 'sonner'

// Production: set VITE_API_URL (no trailing slash). Local: uses proxy /api/v1
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout for uploads
})

export interface FriendlyApiError {
  message: string
  original: unknown
}

/** Normalize API error detail (string, object, or array) to a single message string. */
function formatDetail(detail: unknown): string {
  if (detail == null) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (first && typeof first === 'object' && first !== null && 'msg' in first)
      return String((first as { msg?: string }).msg ?? JSON.stringify(first))
    return detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? (d as { msg: string }).msg : String(d))).join('; ')
  }
  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof (detail as { message: unknown }).message === 'string')
      return (detail as { message: string }).message
    if ('msg' in detail && typeof (detail as { msg: unknown }).msg === 'string')
      return (detail as { msg: string }).msg
    if ('detail' in detail && typeof (detail as { detail: unknown }).detail === 'string')
      return (detail as { detail: string }).detail
    return JSON.stringify(detail)
  }
  return String(detail)
}

/** Ensure value is a displayable string (never [object Object]). */
function toDisplayString(msg: unknown): string {
  if (msg == null) return ''
  if (typeof msg === 'string') return msg
  if (typeof msg === 'object' && msg !== null) return formatDetail(msg)
  return String(msg)
}

/**
 * Extract a displayable error message from any caught error.
 * Handles both FriendlyApiError (from API interceptor) and raw Axios/other errors.
 * Use this in catch blocks instead of ad-hoc error parsing.
 */
export function getApiErrorDetail(error: unknown): string {
  // FriendlyApiError from our interceptor
  if (error && typeof error === 'object' && 'message' in error && typeof (error as FriendlyApiError).message === 'string') {
    return (error as FriendlyApiError).message
  }
  // Raw Axios error
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    // Blob response (e.g. exportTransform with responseType: 'blob')
    if (data instanceof Blob && data.type?.includes('json')) {
      return 'Download failed. Please try again.'
    }
    const rawDetail = data && typeof data === 'object' && 'detail' in data ? (data as { detail?: unknown }).detail : data
    const msg = formatDetail(rawDetail) || (error.message ?? 'Request failed')
    return msg || 'An error occurred'
  }
  if (error instanceof Error) return error.message
  return toDisplayString(error) || 'An error occurred'
}

/** Parse API/axios errors into user-friendly messages. */
export function parseError(error: unknown): FriendlyApiError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data
    // Blob response (e.g. exportTransform): cannot parse, use generic message
    if (data instanceof Blob) {
      const msg = status && status >= 400 ? (status === 413 ? 'File too large' : status === 404 ? 'File not found' : 'Download failed. Please try again.') : 'Request failed'
      return { message: msg, original: error }
    }
    const dataObj = data as { message?: string; detail?: unknown } | undefined
    const rawDetail = dataObj?.detail
    const serverMessage = dataObj?.message ?? formatDetail(rawDetail) ?? (typeof data === 'string' ? data : '')
    const msg = String(serverMessage || error.message || 'Request failed')

    if (error.code === 'ECONNABORTED' || error.message?.toLowerCase().includes('timeout')) {
      return { message: 'Request timed out. Please try again.', original: error }
    }
    if (error.message?.toLowerCase().includes('network') || error.code === 'ERR_NETWORK') {
      return { message: 'Unable to connect. Check your internet connection.', original: error }
    }
    if (status === 404) {
      return { message: "The file or resource you're looking for doesn't exist.", original: error }
    }
    if (status === 500) {
      // Prefer server detail; also handle response body as plain string
      let detailMsg = serverMessage || formatDetail(rawDetail)
      if (!detailMsg && typeof data === 'string' && data.trim()) detailMsg = data
      const message = toDisplayString(detailMsg) || 'Something went wrong on our end. Please try again.'
      return { message, original: error }
    }
    if (status === 413) {
      return { message: 'This file is too large. Maximum size is 50MB.', original: error }
    }
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after'] || '60'
      return {
        message: `Rate limit exceeded. Please wait ${retryAfter} seconds and try again.`,
        original: error,
      }
    }
    if (status === 422 || status === 400) {
      const message = toDisplayString(serverMessage) || 'Validation failed. Check your input.'
      return { message, original: error }
    }
    return { message: msg || 'Request failed. Please try again.', original: error }
  }
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  return { message, original: error }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const friendly = parseError(error)
    const message = typeof friendly.message === 'string' ? friendly.message : toDisplayString(friendly.message)
    toast.error(message)
    return Promise.reject(friendly)
  }
)

export interface UploadResponse {
  fileId: string
  fileName: string
  sheets: string[]
}

export interface DataQualityIssue {
  severity: 'high' | 'medium'
  column: string
  message: string
}

export interface DataQuality {
  overall_score: number
  completeness: number
  duplicate_rows: number
  duplicate_percentage: number
  total_rows: number
  total_columns: number
  issues: DataQualityIssue[]
  column_quality?: Record<string, { nulls: number; null_percentage: number }>
}

export interface PreviewResponse {
  fileId: string
  sheetName: string
  columns: string[]
  rows: Record<string, unknown>[]
  headerRowIndex?: number
  warning?: string
  quality?: DataQuality
}

export interface CellChange {
  rowIndex: number
  column: string
  oldValue: unknown
  newValue: unknown
  operationIndex: number
  operationType: string
}

export interface OperationChange {
  operationIndex: number
  operationType: string
  operationSummary: string
  cellsChanged: CellChange[]
  rowsAffected: number[]
  columnsAffected: string[]
}

export interface TransformResponse {
  fileId: string
  sheetName: string
  columns: string[]
  rows: Record<string, unknown>[]
  rowCountBefore: number
  rowCountAfter: number
  newColumns: string[]
  headerRowIndex?: number
  warning?: string
  changes?: OperationChange[]
}

export interface ApiError {
  error_type?: string
  column_name?: string
  available_columns?: string[]
  message?: string
  detail?: string | ApiError
}

export interface Operation {
  id?: string  // Optional: will be generated by backend if not provided
  type: 'filter' | 'replace' | 'math' | 'sort' | 'select_columns' | 'remove_duplicates' | 'aggregate' | 'text_cleanup' | 'split_column' | 'merge_columns' | 'date_format' | 'remove_blank_rows' | 'convert_to_numeric' | 'gross_profit' | 'net_profit' | 'profit_loss'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Operation params vary by type; full typing deferred
  params: Record<string, any>
}

export interface ValidationError {
  opIndex: number
  opId: string
  opType: string
  message: string
}

export interface ValidatePipelineResponse {
  ok: boolean
  errors: ValidationError[]
}

export interface MergeFilesRequest {
  fileIds: string[]
  strategy: 'append' | 'join' | 'union'
  joinColumn?: string
  joinType?: 'inner' | 'left' | 'right' | 'outer'
  headerRowIndex?: number
}

export interface MergeFilesResponse {
  mergedFileId: string
  fileName: string
  sheets: string[]
  rowCount: number
  columnCount: number
  warning?: string
}

export interface BatchTransformRequest {
  fileIds: string[]
  sheetName: string
  operations: Operation[]
  headerRowIndex?: number
  outputFormat?: 'individual' | 'zip'
}

export interface BatchTransformResult {
  fileId: string
  fileName: string
  transformedFileId?: string
  transformedFileName?: string
  rowCountBefore: number
  rowCountAfter: number
}

export interface BatchTransformResponse {
  results: BatchTransformResult[]
  zipUrl?: string
  zipId?: string
  errors?: Array<{ fileId: string; fileName: string; error: string }>
}

export interface MultipleUploadResponse {
  files: UploadResponse[]
  errors?: Array<{ fileName: string; error: string }>
}

export interface Insight {
  type: 'quality' | 'analysis'
  title: string
  description: string
  severity: 'info' | 'warning' | 'error'
  recommendation?: string
}

export interface VisualizationSuggestion {
  type: 'bar' | 'line' | 'scatter' | 'histogram' | 'pie'
  title: string
  x?: string
  y?: string
  category?: string
  value?: string
  column?: string
}

export interface AnalysisSummary {
  total_rows: number
  total_columns: number
  numeric_columns: number
  text_columns: number
  completeness: number
}

export interface AnalyzeDataRequest {
  columns: string[]
  rows: Record<string, unknown>[]
}

export interface AnalyzeDataResponse {
  insights: Insight[]
  visualizations: VisualizationSuggestion[]
  summary: AnalysisSummary
}

export interface AIAssistantAnalysis {
  summary: string
  insights: string[]
  data_quality_notes: string[]
  recommended_actions: string[]
  suggested_pipeline: Operation[]
}

export interface AIAnalyzeDataRequest {
  fileId: string
  sheetName?: string
  userProfile: string
}

export interface AIAnalyzeDataResponse {
  success: boolean
  analysis: AIAssistantAnalysis
}

export interface AIChatRequest {
  message: string
  dataContext: Record<string, unknown>
}

export interface AIChatResponse {
  success: boolean
  response: string
}

export interface AIExplainRequest {
  dataContext: Record<string, unknown>
  insightType: string
}

export interface AIExplainResponse {
  success: boolean
  explanation: string
}

export interface AISuggestNextStepRequest {
  stage: string
  dataSummary: Record<string, unknown>
  currentPipeline: Operation[]
  userProfile: string
}

export interface AISuggestNextStepResponse {
  success: boolean
  suggestion: string
}

export const excelApi = {
  /**
   * Upload Excel file and get sheet names
   */
  uploadFile: async (file: File): Promise<UploadResponse> => {
    const sendUpload = async (uploadFile: File): Promise<UploadResponse> => {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const response = await api.post<UploadResponse>('/upload-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      return response.data
    }

    try {
      return await sendUpload(file)
    } catch (error: unknown) {
      // Graceful fallback: some CSV files are mislabeled as .xlsx by users/download sources.
      const detail = getApiErrorDetail(error).toLowerCase()
      const isLikelyMislabeledXlsx =
        file.name.toLowerCase().endsWith('.xlsx') &&
        detail.includes('does not appear to be a valid excel file')

      if (!isLikelyMislabeledXlsx) {
        throw error
      }

      const csvName = file.name.replace(/\.xlsx$/i, '.csv')
      const csvLikeFile = new File([file], csvName, { type: 'text/csv' })
      return await sendUpload(csvLikeFile)
    }
  },

  /**
   * Preview a specific sheet
   */
  previewSheet: async (
    fileId: string,
    sheetName: string,
    limit: number = 10
  ): Promise<PreviewResponse> => {
    const response = await api.get<PreviewResponse>(
      '/preview-sheet',
      {
        params: {
          fileId: fileId,
          sheetName: sheetName,
          limit: limit,
        },
      }
    )
    return response.data
  },

  /**
   * Preview transformation with operations
   */
  previewTransform: async (
    fileId: string,
    sheetName: string,
    operations: Operation[],
    headerRowIndex?: number
  ): Promise<TransformResponse> => {
    const payload: Record<string, unknown> = {
      fileId,
      sheetName,
      operations,
    }
    if (headerRowIndex !== undefined) {
      payload.headerRowIndex = headerRowIndex
    }
    const response = await api.post<TransformResponse>(
      '/preview-transform',
      payload
    )
    return response.data
  },

  /**
   * Validate a transformation pipeline without applying it
   */
  validatePipeline: async (
    fileId: string,
    sheetName: string,
    operations: Operation[],
    headerRowIndex?: number
  ): Promise<ValidatePipelineResponse> => {
    const payload: Record<string, unknown> = {
      fileId,
      sheetName,
      operations,
    }
    if (headerRowIndex !== undefined) {
      payload.headerRowIndex = headerRowIndex
    }
    const response = await api.post<ValidatePipelineResponse>(
      '/validate-pipeline',
      payload
    )
    return response.data
  },

  /**
   * Upload multiple Excel files
   */
  uploadMultipleFiles: async (files: File[]): Promise<MultipleUploadResponse> => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })
    
    const response = await api.post<MultipleUploadResponse>('/upload-multiple-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  /**
   * Merge multiple files
   */
  mergeFiles: async (request: MergeFilesRequest): Promise<MergeFilesResponse> => {
    const response = await api.post<MergeFilesResponse>('/merge-files', request)
    return response.data
  },

  /**
   * Batch transform multiple files
   */
  batchTransform: async (request: BatchTransformRequest): Promise<BatchTransformResponse> => {
    const response = await api.post<BatchTransformResponse>(
      '/batch-transform',
      request,
      // Batch transforms can take longer than uploads (multiple files + Excel export).
      // Bump timeout to avoid "Request timed out" for large datasets.
      { timeout: 180000 }
    )
    return response.data
  },

  /**
   * Download a batch transformation ZIP by ID
   */
  downloadBatchZip: async (zipId: string): Promise<Blob> => {
    const response = await api.get(`/download-batch-zip`, {
      params: { zipId },
      responseType: 'blob',
      // ZIP creation/download can exceed the 60s default for larger batches.
      timeout: 180000,
    })
    return response.data as Blob
  },

  /**
   * Export transformed file
   */
  exportTransform: async (
    fileId: string,
    sheetName: string,
    operations: Operation[],
    headerRowIndex?: number
  ): Promise<Blob> => {
    const payload: Record<string, unknown> = {
      fileId,
      sheetName,
      operations,
    }
    if (headerRowIndex !== undefined) {
      payload.headerRowIndex = headerRowIndex
    }
    const response = await api.post(
      '/export-transform',
      payload,
      // Export can be expensive (full DataFrame + styled Excel),
      // so allow a larger timeout than the default axios instance.
      { responseType: 'blob', timeout: 180000 }
    )
    return response.data
  },

  /**
   * Analyze data and return insights and visualization suggestions
   */
  analyzeData: async (request: AnalyzeDataRequest): Promise<AnalyzeDataResponse> => {
    const response = await api.post<AnalyzeDataResponse>('/analyze-data', request)
    return response.data
  },
}

export const aiApi = {
  analyzeData: async (request: AIAnalyzeDataRequest): Promise<AIAnalyzeDataResponse> => {
    const response = await api.post<AIAnalyzeDataResponse>('/ai/analyze-data', request)
    return response.data
  },

  chat: async (request: AIChatRequest): Promise<AIChatResponse> => {
    const response = await api.post<AIChatResponse>('/ai/chat', request)
    return response.data
  },

  explainInsight: async (request: AIExplainRequest): Promise<AIExplainResponse> => {
    const response = await api.post<AIExplainResponse>('/ai/explain-insight', request)
    return response.data
  },

  suggestNextStep: async (request: AISuggestNextStepRequest): Promise<AISuggestNextStepResponse> => {
    const response = await api.post<AISuggestNextStepResponse>('/ai/suggest-next-step', request)
    return response.data
  },
}

export default api
