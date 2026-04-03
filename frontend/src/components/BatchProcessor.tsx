import { useState, useEffect } from 'react'
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
import { excelApi, getApiErrorDetail, type BatchTransformRequest, type BatchTransformResponse, type UploadResponse, type Operation } from '@/lib/api'
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
  const [outputFormat, setOutputFormat] = useState<'individual' | 'zip'>('zip')
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<BatchTransformResponse | null>(null)
  const [aiSeedKey, setAiSeedKey] = useState(0)

  // Sheet dropdown options: union across all selected files.
  // Note: batch processing uses a single `sheetName` for all files; files that
  // don't contain that sheet will appear as per-file errors in the batch result.
  const sheetOptions = files.length > 0 ? Array.from(new Set(files.flatMap((f) => f.sheets))) : []
  const defaultSheet = sheetOptions[0] || ''
  const firstFile = files[0]

  // If the user hasn't picked a sheet yet, default-select the first available option.
  // This ensures the "Transformation Pipeline" section can render immediately.
  useEffect(() => {
    if (!sheetName && defaultSheet) setSheetName(defaultSheet)
  }, [defaultSheet])

  // Load columns from first file when sheet is selected (for PipelineBuilder)
  useEffect(() => {
    if (!firstFile || !sheetName) {
      setColumns([])
      return
    }
    let cancelled = false
    setColumnsLoading(true)
    excelApi.previewSheet(firstFile.fileId, sheetName, 5)
      .then((res) => {
        if (!cancelled && res.columns) setColumns(res.columns)
      })
      .catch(() => {
        if (!cancelled) setColumns([])
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false)
      })
    return () => { cancelled = true }
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
        const response = await fetch(results.zipUrl)
        blob = await response.blob()
      } else {
        throw new Error('No ZIP identifier available for download')
      }
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `batch_transformed_${Date.now()}.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
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
            <Label htmlFor="sheet-name">Sheet Name (applies to all files)</Label>
            <Select value={sheetName} onValueChange={setSheetName}>
              <SelectTrigger id="sheet-name">
                <SelectValue placeholder="Select sheet" />
              </SelectTrigger>
              <SelectContent>
                {sheetOptions.map((sheet) => (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      {sheetName && firstFile && (
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
            ) : columns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Select a sheet and wait for columns to load, or the sheet may be empty.
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
            disabled={isProcessing || !sheetName || operations.length === 0}
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
            <div className="space-y-2">
              {results.results.map((result, idx) => (
                <div key={idx} className="text-sm p-2 bg-muted rounded">
                  <strong>{result.fileName}</strong>: {result.rowCountBefore} → {result.rowCountAfter} rows
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

            {results.zipUrl && (
              <Button onClick={handleDownloadZip} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Download ZIP File
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {config.features.showAutoAnalysis && config.features.showBatchProcessing && firstFile && sheetName && (
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

