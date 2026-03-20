/**
 * DataInsights component: Automatically analyzes data and displays insights.
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle, Info, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { excelApi, type Insight, type AnalysisSummary } from '@/lib/api'
import { cn } from '@/lib/utils'

interface DataInsightsProps {
  columns: string[]
  rows: Record<string, unknown>[]
  /** Show summary statistics */
  showSummary?: boolean
}

export function DataInsights({ columns, rows, showSummary = true }: DataInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      analyzeData()
    } else {
      setLoading(false)
    }
  }, [columns, rows])

  const analyzeData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await excelApi.analyzeData({ columns, rows })
      setInsights(result.insights)
      setSummary(result.summary)
    } catch (err) {
      console.error('Analysis error:', err)
      setError('Failed to analyze data')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityIcon = (severity: Insight['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: Insight['severity']) => {
    switch (severity) {
      case 'error':
        return 'border-destructive/50 bg-destructive/10'
      case 'warning':
        return 'border-amber-500/50 bg-amber-500/10'
      case 'info':
        return 'border-blue-500/50 bg-blue-500/10'
      default:
        return 'border-muted bg-muted/50'
    }
  }

  if (columns.length === 0 || rows.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🔍</span>
          Data Insights
        </CardTitle>
        <CardDescription>Automatic analysis of your data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Analyzing data...</span>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analysis Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <>
            {showSummary && summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.total_rows.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.total_columns}</div>
                  <div className="text-xs text-muted-foreground">Columns</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.numeric_columns}</div>
                  <div className="text-xs text-muted-foreground">Numeric</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.text_columns}</div>
                  <div className="text-xs text-muted-foreground">Text</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{summary.completeness.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Complete</div>
                </div>
              </div>
            )}

            {insights.length === 0 ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertTitle>No Issues Found</AlertTitle>
                <AlertDescription>
                  Your data looks good! No quality issues or anomalies detected.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {insights.map((insight, i) => (
                  <Alert
                    key={i}
                    className={cn('border-l-4', getSeverityColor(insight.severity))}
                  >
                    <div className="flex items-start gap-2">
                      {getSeverityIcon(insight.severity)}
                      <div className="flex-1">
                        <AlertTitle className="text-sm font-semibold">
                          {insight.title}
                        </AlertTitle>
                        <AlertDescription className="text-sm mt-1">
                          {insight.description}
                        </AlertDescription>
                        {insight.recommendation && (
                          <div className="mt-2 text-xs text-muted-foreground italic">
                            💡 {insight.recommendation}
                          </div>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
