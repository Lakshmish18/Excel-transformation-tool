import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { SkeletonTable } from '@/components/skeletons'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { excelApi, getApiErrorDetail, type Operation, type TransformResponse } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'
import { AlertCircle, Eye } from 'lucide-react'

const PREVIEW_ROWS = 10

interface LivePreviewProps {
  fileId: string
  sheetName: string
  operations: Operation[]
  columns: string[]
  debounceMs?: number
}

export function LivePreview({
  fileId,
  sheetName,
  operations,
  columns: _columns,
  debounceMs = 500,
}: LivePreviewProps) {
  const debouncedOps = useDebounce(operations, debounceMs)
  const [data, setData] = useState<TransformResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!fileId || !sheetName || debouncedOps.length === 0) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const ops = debouncedOps.map((op) => {
      const { id, summary, ...rest } = op as Operation & { id?: string; summary?: string }
      return rest
    })
    excelApi
      .previewTransform(fileId, sheetName, ops, undefined)
      .then((res) => {
        if (!cancelled) {
          setData(res)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(getApiErrorDetail(err))
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fileId, sheetName, debouncedOps])

  if (operations.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Add operations to see a live preview of the first 10 rows.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4 text-muted-foreground" />
            Live Preview
          </CardTitle>
          {data && (
            <Badge variant="secondary" className="text-xs">
              Showing {Math.min(PREVIEW_ROWS, data.rows.length)} of {data.rowCountAfter} rows
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="overflow-auto max-h-[400px] rounded-md border">
            <SkeletonTable rows={5} columns={5} />
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Preview error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!loading && !error && data && data.rows.length > 0 && (
          <div className="overflow-auto max-h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  {data.columns.map((col) => (
                    <TableHead key={col} className="whitespace-nowrap text-xs">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.slice(0, PREVIEW_ROWS).map((row, idx) => (
                  <TableRow key={idx}>
                    {data.columns.map((col) => (
                      <TableCell key={col} className="text-xs">
                        {row[col] != null ? String(row[col]) : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {!loading && !error && data && data.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No rows after transformation.</p>
        )}
      </CardContent>
    </Card>
  )
}
