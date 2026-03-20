import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Eye, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SkeletonTable } from '@/components/skeletons'
import { EditableTable } from '@/components/EditableTable'
import { DataInsights } from '@/components/DataInsights'
import { AutoCharts } from '@/components/AutoCharts'
import { DataQualityCard } from '@/components/DataQualityCard'
import { excelApi, type PreviewResponse, type TransformResponse } from '@/lib/api'
import { PipelineBuilder } from '@/components/PipelineBuilder'
import { OperationsPanel } from '@/components/OperationsPanel'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'

/** Normalize API error detail (string, object, or array) to a single display string. */
function formatErrorDetail(detail: unknown): string {
  if (detail == null) return 'Failed to load preview'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0]
    if (first && typeof first === 'object' && 'msg' in first) return String((first as { msg?: string }).msg ?? JSON.stringify(first))
    return detail.map((d) => (typeof d === 'object' && d && 'msg' in d ? (d as { msg: string }).msg : String(d))).join('; ')
  }
  if (typeof detail === 'object' && detail !== null) {
    if ('message' in detail && typeof (detail as { message: unknown }).message === 'string') return (detail as { message: string }).message
    if ('msg' in detail && typeof (detail as { msg: unknown }).msg === 'string') return (detail as { msg: string }).msg
    return JSON.stringify(detail)
  }
  return String(detail)
}

interface PreviewSectionProps {
  fileId: string
  fileName: string
  sheets: string[]
  showOperationsPanel?: boolean
  /** Controlled: initial sheet (e.g. from context) */
  initialSheet?: string
  /** Callback when sheet selection changes (e.g. sync to context) */
  onSheetChange?: (sheet: string) => void
  /** Whether to show data quality card (profile-based) */
  showDataQuality?: boolean
}

export function PreviewSection({
  fileId,
  fileName,
  sheets,
  showOperationsPanel = false,
  initialSheet,
  onSheetChange,
  showDataQuality = true,
}: PreviewSectionProps) {
  const [selectedSheet, setSelectedSheetState] = useState<string>(initialSheet || sheets[0] || '')
  const setSelectedSheet = (s: string) => {
    setSelectedSheetState(s)
    onSheetChange?.(s)
  }
  useEffect(() => {
    if (initialSheet) setSelectedSheetState(initialSheet)
  }, [initialSheet])
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [transformData, setTransformData] = useState<TransformResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update selectedSheet when sheets change
  useEffect(() => {
    if (sheets.length > 0 && !sheets.includes(selectedSheet)) {
      setSelectedSheet(sheets[0])
      setPreviewData(null) // Clear preview when sheet list changes
    }
  }, [sheets, selectedSheet])

  // Fetch preview when fileId and selectedSheet are available (on mount and when sheet changes)
  useEffect(() => {
    if (!fileId || !selectedSheet) return

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setPreviewData(null)
    setTransformData(null)

    logger.debug('API call starting...', { fileId, sheetName: selectedSheet })

    excelApi
      .previewSheet(fileId, selectedSheet, 50)
      .then((response) => {
        if (!cancelled) {
          logger.debug('Preview API response:', { 
            columns: response.columns?.length, 
            rows: response.rows?.length,
            sheetName: response.sheetName 
          })
          setPreviewData(response)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const errObj = err && typeof err === 'object'
          ? (err as { original?: { response?: { data?: { detail?: unknown } } }; response?: { data?: { detail?: unknown } }; message?: string })
          : { response: err }
        const res = ('original' in errObj ? (errObj as { original?: { response?: unknown } }).original?.response : undefined) ?? ('response' in errObj ? (errObj as { response?: unknown }).response : err)
        const errorDetail = res && typeof res === 'object' && 'data' in res ? (res as { data?: { detail?: unknown } }).data?.detail : undefined
        const colErr = errorDetail && typeof errorDetail === 'object' && !Array.isArray(errorDetail) ? errorDetail as { error_type?: string; column_name?: string; available_columns?: string[] } : null
        if (colErr && colErr.error_type === 'COLUMN_NOT_FOUND') {
          const columnName = colErr.column_name || 'unknown'
          const availableCols = colErr.available_columns || []
          setError(
            `The column '${columnName}' was not found. Available columns: ${availableCols.join(', ')}`
          )
        } else {
          setError(formatErrorDetail(errorDetail) || (errObj && 'message' in errObj ? String(errObj.message) : '') || 'Failed to load preview')
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fileId, selectedSheet])

  const handlePreview = async () => {
    if (!selectedSheet) return

    setIsLoading(true)
    setError(null)
    setPreviewData(null)
    setTransformData(null) // Clear transform data when loading new preview

    try {
      logger.debug('API call starting... (button)', { fileId, sheetName: selectedSheet })
      const response = await excelApi.previewSheet(fileId, selectedSheet, 10)
      setPreviewData(response)
      // Warning is shown separately, non-blocking
    } catch (err: unknown) {
      const errObj = err && typeof err === 'object' ? (err as { original?: { response?: { data?: { detail?: unknown } } }; response?: { data?: { detail?: unknown } }; message?: string }) : { message: String(err) }
      const res = errObj.original?.response ?? errObj.response
      const errorDetail = res && typeof res === 'object' && 'data' in res ? (res as { data?: { detail?: unknown } }).data?.detail : undefined
      const colErr = errorDetail && typeof errorDetail === 'object' && !Array.isArray(errorDetail) ? errorDetail as { error_type?: string; column_name?: string; available_columns?: string[] } : null
      if (colErr && colErr.error_type === 'COLUMN_NOT_FOUND') {
        const columnName = colErr.column_name || 'unknown'
        const availableCols = colErr.available_columns || []
        setError(
          `The column '${columnName}' was not found. Available columns: ${availableCols.join(', ')}`
        )
      } else {
        setError(formatErrorDetail(errorDetail) || errObj.message || 'Failed to load preview')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleTransformSuccess = (data: TransformResponse) => {
    setTransformData(data)
    setError(null)
    // Update preview data with transformed data
    setPreviewData({
      fileId: data.fileId,
      sheetName: data.sheetName,
      columns: data.columns,
      rows: data.rows,
    })
  }

  const [selectedOperationType, setSelectedOperationType] = useState<string>('')

  if (showOperationsPanel) {
    return (
      <div className="h-full flex flex-col">
        <OperationsPanel 
          onSelectOperation={setSelectedOperationType}
          selectedOperation={selectedOperationType}
        />
        <div className="flex-1 overflow-y-auto p-4 border-t border-gray-300">
          <div className="space-y-4">
            {/* Sheet Selection */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Select Sheet</label>
              <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sheets.map((sheet) => (
                    <SelectItem key={sheet} value={sheet}>
                      {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              onClick={handlePreview}
              disabled={isLoading || !selectedSheet}
              className="w-full bg-[#217346] hover:bg-[#1a5a38] text-white"
              size="sm"
            >
              {isLoading ? (
                <>
                  <Eye className="h-3.5 w-3.5 mr-2 animate-pulse" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  Preview Sheet
                </>
              )}
            </Button>

            {error && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {error}
              </div>
            )}

            {previewData && (
              <div className="text-xs text-gray-600">
                {previewData.rows.length} rows, {previewData.columns.length} columns
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-4xl mx-auto" data-tour="preview-table">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Preview Sheet Data
        </CardTitle>
        <CardDescription>
          Select a sheet and click Preview to see the first 10 rows
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          <span className="font-medium">{fileName}</span>
          <span>•</span>
          <span>{sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Sheet Selection and Preview Button */}
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Select Sheet</label>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger>
                <SelectValue placeholder="Select a sheet" />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((sheet) => (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handlePreview}
            disabled={isLoading || !selectedSheet}
            size="lg"
          >
            {isLoading ? (
              <>
                <Eye className="h-4 w-4 mr-2 animate-pulse" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>
        </div>

        {/* Preview loading skeleton */}
        {isLoading && (
          <div className="border rounded-md overflow-hidden max-h-[600px]">
            <SkeletonTable rows={5} columns={5} />
          </div>
        )}

        {/* Error Message */}
        {error && error.trim() && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Preview error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Warning Message (non-blocking) */}
        {previewData?.warning && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-md text-sm">
            <strong>Note:</strong> {previewData.warning}
          </div>
        )}

        {/* Data Quality Score */}
        {!isLoading && previewData?.quality && showDataQuality && (
          <div className="mt-6">
            <DataQualityCard quality={previewData.quality} />
          </div>
        )}

        {/* Data Insights */}
        {!isLoading && previewData && (
          <div className="mt-6">
            <DataInsights columns={previewData.columns} rows={previewData.rows} />
          </div>
        )}

        {/* Auto-generated Charts */}
        {!isLoading && previewData && (
          <div className="mt-6">
            <AutoCharts columns={previewData.columns} rows={previewData.rows} />
          </div>
        )}

        {/* Preview Table */}
        {!isLoading && previewData && (
          <div className="space-y-4 mt-6">
            <div className="text-sm text-muted-foreground">
              {transformData ? (
                <>
                  Showing first {previewData.rows.length} rows from <strong>{previewData.sheetName}</strong>
                  <span className="ml-4">
                    • Rows: {transformData.rowCountBefore} → {transformData.rowCountAfter}
                    {transformData.newColumns.length > 0 && (
                      <span className="ml-2">
                        • New columns: {transformData.newColumns.join(', ')}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  Showing first {previewData.rows.length} rows from <strong>{previewData.sheetName}</strong>
                </>
              )}
            </div>
            <EditableTable
              columns={previewData.columns}
              rows={previewData.rows}
              editable={true}
              showSaveButton={true}
              maxHeight="600px"
              onSave={(updatedRows: Record<string, unknown>[]) => {
                // Update preview data with edited rows
                setPreviewData({
                  ...previewData,
                  rows: updatedRows,
                })
                toast.success('Preview data updated')
              }}
            />
          </div>
        )}

        {/* Pipeline Builder */}
        {previewData && (
          <div className="mt-6">
            <PipelineBuilder
              fileId={fileId}
              sheetName={selectedSheet}
              columns={previewData.columns}
              onTransformSuccess={handleTransformSuccess}
              onError={setError}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

