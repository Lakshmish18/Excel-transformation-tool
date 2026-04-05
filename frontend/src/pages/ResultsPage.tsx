/**
 * Results: full preview, download, modify pipeline.
 */
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataPreview } from '@/components/DataPreview'
import { DataInsights } from '@/components/DataInsights'
import { AutoCharts } from '@/components/AutoCharts'
import { AutoKPIs } from '@/components/AutoKPIs'
import { ColumnProfiler } from '@/components/ColumnProfiler'
import { SkeletonTable } from '@/components/skeletons'
import { useApp } from '@/context/AppContext'
import { excelApi } from '@/lib/api'
import { Download, RotateCcw, Edit, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import confetti from 'canvas-confetti'
import { saveTransformationHistory } from '@/lib/supabase-history'
import { logger } from '@/lib/logger'
import { RowCountIndicator } from '@/components/RowCountIndicator'
import { uploadTransformedFile } from '@/lib/supabase-storage'
import { useProfile } from '@/context/ProfileContext'

export function ResultsPage() {
  const navigate = useNavigate()
  const { uploadData, selectedSheet, operations, transformResult } = useApp()
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedColumn, setSelectedColumn] = useState<string>('')
  const { config } = useProfile()

  useEffect(() => {
    if (!uploadData || !selectedSheet) {
      navigate('/preview', { replace: true })
    }
  }, [uploadData, selectedSheet, navigate])

  useEffect(() => {
    if (transformResult) {
      setInitialLoadDone(true)
      return
    }
    const t = setTimeout(() => setInitialLoadDone(true), 400)
    return () => clearTimeout(t)
  }, [transformResult])

  const handleDownload = async () => {
    if (!uploadData || !selectedSheet) {
      toast.error('Missing file or sheet information')
      return
    }
    
    // Use operations from context
    const opsToUse = operations && operations.length > 0 ? operations : []
    
    if (opsToUse.length === 0) {
      toast.error('No operations found. Please go back to Pipeline page and run the transformation again.')
      console.error('Download failed: operations array is empty', { operations, transformResult })
      return
    }
    
    if (!transformResult) {
      toast.error('No transformation result found. Please run the pipeline first.')
      return
    }

    setIsDownloading(true)
    try {
      logger.debug('Exporting transform:', { fileId: uploadData.fileId, sheetName: selectedSheet, operationsCount: opsToUse.length })
      
      const blob = await excelApi.exportTransform(uploadData.fileId, selectedSheet, opsToUse)
      
      if (!blob || blob.size === 0) {
        throw new Error('Received empty file from server')
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transformed_${uploadData.fileName.replace(/\.xlsx?$/i, '')}_${Date.now()}.xlsx`
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)
      
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } })
      toast.success('File downloaded successfully!')
      
      // Save transformation history and upload file to Supabase (non-blocking)
      try {
        const fileUrl = await uploadTransformedFile(blob, uploadData.fileName)
        await saveTransformationHistory(
          uploadData.fileName,
          opsToUse,
          transformResult.rowCountBefore,
          transformResult.rowCountAfter,
          undefined,
          fileUrl || undefined,
          undefined,
          'success'
        )
      } catch (historyError) {
        console.error('Failed to save history:', historyError)
      }
    } catch (e: unknown) {
      console.error('Download error:', e)
      // Axios interceptor already shows a user-friendly toast.
    } finally {
      setIsDownloading(false)
    }
  }

  if (!uploadData || !selectedSheet) return null

  return (
    <div className="p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Transformed Data</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/pipeline">
                <Edit className="h-4 w-4 mr-1" />
                Modify Pipeline
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Start Over
            </Button>
            <Button 
              size="sm" 
              onClick={handleDownload} 
              disabled={isDownloading || !uploadData || !selectedSheet || !operations || operations.length === 0}
              title={operations && operations.length > 0 ? `Download transformed file (${operations.length} operations)` : 'No operations to export'}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {transformResult ? (
            <div className="space-y-6">
              {/* Auto KPIs */}
              {config.features.showKPIs && (
                <AutoKPIs data={transformResult.rows} columns={transformResult.columns} />
              )}

              {/* Row Count Indicator */}
              <RowCountIndicator
                originalCount={transformResult.rowCountBefore}
                currentCount={transformResult.rowCountAfter}
                operationName={
                  operations && operations.length > 0
                    ? `${operations.length} operation${operations.length > 1 ? 's' : ''}`
                    : undefined
                }
              />
              {/* Data Insights */}
              <DataInsights columns={transformResult.columns} rows={transformResult.rows} />

              {/* Auto-generated Charts (trend-style visuals) */}
              {config.features.showTrendCharts && (
                <AutoCharts columns={transformResult.columns} rows={transformResult.rows} />
              )}

              {/* Column Profiler */}
              {config.features.showColumnProfiling && transformResult.columns.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Column Profiler</label>
                  <Select value={selectedColumn || transformResult.columns[0]} onValueChange={setSelectedColumn}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {transformResult.columns.map((col) => (
                        <SelectItem key={col} value={col}>{col}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ColumnProfiler
                    column={selectedColumn || transformResult.columns[0]}
                    data={transformResult.rows}
                  />
                </div>
              )}

              {/* Data Preview Table */}
              <DataPreview
                sheets={uploadData.sheets}
                initialSheet={selectedSheet}
                previewData={{
                  fileId: uploadData.fileId,
                  sheetName: selectedSheet,
                  columns: transformResult.columns,
                  rows: transformResult.rows,
                }}
              />
            </div>
          ) : !initialLoadDone ? (
            <SkeletonTable rows={5} columns={5} />
          ) : (
            <p className="text-muted-foreground">Run & Preview from Pipeline page to see results.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
