/**
 * Batch results: summary, per-file actions, ZIP download.
 */
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Eye, FileDown, Home, RotateCcw } from 'lucide-react'
import type { BatchTransformResponse, BatchTransformResult } from '@/lib/api'
import { excelApi } from '@/lib/api'
import { downloadBlob } from '@/lib/downloadHelpers'
import { useApp } from '@/context/AppContext'
import { toast } from 'sonner'

export function BatchResultsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUploadData } = useApp()
  const result = location.state?.result as BatchTransformResponse | undefined

  const handleDownloadZip = async () => {
    if (!result || (!result.zipId && !result.zipUrl)) return
    try {
      let blob: Blob
      if (result.zipId) {
        blob = await excelApi.downloadBatchZip(result.zipId)
      } else if (result.zipUrl) {
        const base = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '')
        const path = result.zipUrl.startsWith('http')
          ? result.zipUrl
          : `${base}${result.zipUrl.startsWith('/') ? '' : '/'}${result.zipUrl}`
        const res = await fetch(path)
        if (!res.ok) throw new Error('ZIP download failed')
        blob = await res.blob()
      } else {
        return
      }
      downloadBlob(blob, `batch_transformed_${Date.now()}.zip`)
    } catch {
      toast.error('Could not download ZIP. Try again.')
    }
  }

  const handleDownloadOne = async (r: BatchTransformResult) => {
    if (!r.transformedFileId) return
    try {
      const blob = await excelApi.downloadBatchOutput(r.transformedFileId)
      const name = r.transformedFileName || `transformed_${r.fileName}`
      downloadBlob(blob, name.endsWith('.xlsx') ? name : `${name}.xlsx`)
    } catch {
      toast.error(`Could not download ${r.fileName}`)
    }
  }

  const handlePreviewOne = (r: BatchTransformResult) => {
    if (!r.transformedFileId) return
    setUploadData({
      fileId: r.transformedFileId,
      fileName: r.transformedFileName || r.fileName,
      sheets: r.transformedSheets?.length ? r.transformedSheets : ['Sheet1'],
    })
    navigate('/preview')
  }

  if (!result) {
    navigate('/batch', { replace: true })
    return null
  }

  const successCount = result.results?.length ?? 0
  const errorCount = result.errors?.length ?? 0
  const hasZip = Boolean(result.zipId || result.zipUrl)
  const hasIndividualOutputs = result.results?.some((r) => r.transformedFileId)

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch processing complete</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {successCount} file(s) processed successfully.
            {errorCount > 0 && ` ${errorCount} file(s) failed.`}
          </p>
        </CardContent>
      </Card>

      {result.results && result.results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
            <p className="text-sm text-muted-foreground">
              Row counts before → after transformation. Use preview or download when available.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.results.map((r, idx) => (
              <div
                key={idx}
                className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.rowCountBefore} → {r.rowCountAfter} rows
                  </p>
                </div>
                {r.transformedFileId && (
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handlePreviewOne(r)}>
                      <Eye className="h-4 w-4" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownloadOne(r)}>
                      <FileDown className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {result.errors && result.errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Failures</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.errors.map((e, idx) => (
              <div key={idx} className="text-sm p-2 bg-destructive/10 rounded">
                <span className="font-medium">{e.fileName}</span>: {e.error}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasZip && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Download all</CardTitle>
            <p className="text-sm text-muted-foreground">All transformed files in one ZIP archive.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownloadZip} size="lg" className="gap-2 w-full sm:w-auto">
              <Download className="h-5 w-5" />
              Download all (ZIP)
            </Button>
          </CardContent>
        </Card>
      )}

      {!hasZip && !hasIndividualOutputs && successCount > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          No download links were returned. Try processing again or check the batch configuration.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link to="/batch" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Process more
          </Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/" className="gap-2">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  )
}
