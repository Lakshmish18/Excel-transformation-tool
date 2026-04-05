import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Zap, Download, Loader2, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { excelApi, getApiErrorDetail, type BatchTransformRequest, type BatchTransformResponse, type BatchTransformResult, type UploadResponse, type Operation } from '@/lib/api'
import { downloadBlob } from '@/lib/downloadHelpers'
import { sheetsCommonToAllFiles } from '@/lib/batchSheets'
import { PipelineBuilder } from '@/components/PipelineBuilder'
import { useProfile } from '@/context/ProfileContext'
import { AIAssistant } from '@/components/AIAssistant'

interface BatchProcessorProps {
  files: UploadResponse[]
  onError?: (error: string) => void
  onSuccess?: (result: import('@/lib/api').BatchTransformResponse) => void
}

export function BatchProcessor({ files, onError, onSuccess }: BatchProcessorProps) {
  const { profile, config } = useProfile()
  const [sheetName, setSheetName] = useState<string>('')
  const [operations, setOperations] = useState<Operation[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [columnsLoading, setColumnsLoading] = useState(false)
  const [columnLoadError, setColumnLoadError] = useState<string | null>(null)
  const [outputFormat, setOutputFormat] = useState<'individual' | 'zip'>('zip')
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<BatchTransformResponse | null>(null)
  const [aiSeedKey, setAiSeedKey] = useState(0)

  // Only sheets that exist in *every* file — otherwise preview uses file 1 and fails
  // when the selected name exists only in another workbook.
  const sheetOptions = useMemo(() => sheetsCommonToAllFiles(files), [files])
  const firstFile = files[0]

  // Keep selected sheet in sync with the common list.
  useEffect(() => {
    if (sheetOptions.length === 0) {
      setSheetName('')
      return
    }
    setSheetName((prev) => (sheetOptions.includes(prev) ? prev : sheetOptions[0]))
  }, [sheetOptions])

  // Load columns from first file when sheet is selected (for PipelineBuilder)
  useEffect(() => {
    if (!firstFile || !sheetName) {
      setColumns([])
      setColumnLoadError(null)
      return
    }
    let cancelled = false
    setColumnsLoading(true)
    setColumnLoadError(null)
    excelApi
      .previewSheet(firstFile.fileId, sheetName, 5, { skipErrorToast: true })
      .then((res) => {
        if (!cancelled && res.columns) {
          setColumns(res.columns)
          setColumnLoadError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setColumns([])
          setColumnLoadError(getApiErrorDetail(err))
        }
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [firstFile?.fileId, sheetName])

  const handleBatchProcess = async () => {
    if (!sheetName) {
      onError?.('Please select a sheet name')
      return
    }

    if (operations.length === 0) {
      onError?.('Please add at least one operation to the pipeline')
      return
    }

    setIsProcessing(true)
    try {
      const request: BatchTransformRequest = {
        fileIds: files.map(f => f.fileId),
        sheetName,
        operations,
        outputFormat,
      }

      const result = await excelApi.batchTransform(request)
      setResults(result)
      onSuccess?.(result)
    } catch (error: unknown) {
      onError?.(getApiErrorDetail(error))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!results?.zipId && !results?.zipUrl) return

    try {
      let blob: Blob
      if (results.zipId) {
        blob = await excelApi.downloadBatchZip(results.zipId)
      } else if (results.zipUrl) {
        const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')
        const path = results.zipUrl.startsWith('http')
          ? results.zipUrl
          : `${base}${results.zipUrl.startsWith('/') ? '' : '/'}${results.zipUrl}`
        const response = await fetch(path)
        if (!response.ok) throw new Error('ZIP download failed')
        blob = await response.blob()
      } else {
        throw new Error('No ZIP identifier available for download')
      }
      downloadBlob(blob, `batch_transformed_${Date.now()}.zip`)
    } catch (error: unknown) {
      onError?.(`Download failed: ${getApiErrorDetail(error)}`)
    }
  }

  const handleDownloadOne = async (r: BatchTransformResult) => {
    if (!r.transformedFileId) return
    try {
      const blob = await excelApi.downloadBatchOutput(r.transformedFileId)
      const name = r.transformedFileName || `transformed_${r.fileName}`
      downloadBlob(blob, name.endsWith('.xlsx') ? name : `${name}.xlsx`)
    } catch (error: unknown) {
      onError?.(`Download failed: ${getApiErrorDetail(error)}`)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Batch Processing Configuration
          </CardTitle>
          <CardDescription>
            Apply the same transformation pipeline to {files.length} files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sheet-name">Sheet name (must exist in every file)</Label>
            <Select
              value={sheetName}
              onValueChange={setSheetName}
              disabled={sheetOptions.length === 0}
            >
              <SelectTrigger id="sheet-name">
                <SelectValue placeholder={sheetOptions.length ? 'Select sheet' : 'No common sheets'} />
              </SelectTrigger>
              <SelectContent>
                {sheetOptions.map((sheet) => (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sheetOptions.length === 0 && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No matching sheets</AlertTitle>
                <AlertDescription>
                  Batch uses one sheet name for all files. These workbooks share no sheet with the same name.
                  Rename a tab so every file has the same sheet name, or upload files with aligned structure.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div>
            <Label htmlFor="output-format">Output Format</Label>
            <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as 'individual' | 'zip')}>
              <SelectTrigger id="output-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">ZIP File (All files in one archive)</SelectItem>
                <SelectItem value="individual">Individual Files</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Builder - same as single-file mode */}
      {sheetName && firstFile && sheetOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Transformation Pipeline</CardTitle>
            <CardDescription>
              Build your pipeline. Operations will be applied to all {files.length} files.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {columnsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading columns...
              </div>
            ) : columnLoadError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not load this sheet</AlertTitle>
                <AlertDescription>{columnLoadError}</AlertDescription>
              </Alert>
            ) : columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No columns found for this sheet, or the sheet is empty.
              </p>
            ) : (
              <PipelineBuilder
                fileId={firstFile.fileId}
                sheetName={sheetName}
                columns={columns}
                onTransformSuccess={() => {}}
                onError={onError}
                onOperationsChange={setOperations}
                seedOperations={operations}
                seedKey={aiSeedKey}
                batchMode
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleBatchProcess}
            disabled={
              isProcessing ||
              !sheetName ||
              sheetOptions.length === 0 ||
              !!columnLoadError ||
              columns.length === 0 ||
              operations.length === 0
            }
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing {files.length} files...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Process All Files
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle>Batch Processing Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {results.results.map((result, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <strong>{result.fileName}</strong>
                    <span className="text-muted-foreground">
                      {' '}
                      — {result.rowCountBefore} → {result.rowCountAfter} rows
                    </span>
                  </div>
                  {result.transformedFileId && (
                    <Button type="button" variant="outline" size="sm" onClick={() => handleDownloadOne(result)}>
                      Download
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {results.errors && results.errors.length > 0 && (
              <div className="space-y-2 rounded-md border border-yellow-500/60 bg-yellow-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle className="h-4 w-4" />
                  Some files could not be processed
                </div>
                <p className="text-xs text-muted-foreground">
                  The files below failed during batch processing. You can review the errors and re-run the pipeline
                  for just those files if needed.
                </p>
                <div className="space-y-1">
                  {results.errors.map((err, idx) => (
                    <div key={idx} className="text-xs rounded bg-background/80 px-2 py-1">
                      <strong>{err.fileName}</strong>: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(results.zipId || results.zipUrl) && (
              <Button onClick={handleDownloadZip} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download ZIP file
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {config.features.showAutoAnalysis &&
        config.features.showBatchProcessing &&
        firstFile &&
        sheetName &&
        columns.length > 0 &&
        !columnLoadError && (
        <AIAssistant
          fileId={firstFile.fileId}
          sheetName={sheetName}
          userProfile={profile}
          onApplySuggestion={(pipeline) => {
            setOperations(pipeline)
            setAiSeedKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

