/**
 * AISuggestions component: Provides AI-powered transformation and visualization suggestions.
 */
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, Plus, BarChart3, Info, AlertTriangle, Lightbulb } from 'lucide-react'
import { excelApi, type AISuggestionsResponse, type OperationSuggestion, type VisualizationSuggestion, type Insight, type Operation } from '@/lib/api'
import { getOperationLabel } from '@/components/PipelineBuilder/operationsConfig'
import { cn } from '@/lib/utils'

interface AISuggestionsProps {
  columns: string[]
  rows: Record<string, any>[]
  onApplyOperation?: (operation: Operation) => void
  onApplyVisualization?: (viz: VisualizationSuggestion) => void
}

export function AISuggestions({ columns, rows, onApplyOperation, onApplyVisualization }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AISuggestionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getSuggestions = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await excelApi.getAISuggestions({ columns, rows })
      setSuggestions(result)
    } catch (err) {
      console.error('AI suggestions error:', err)
      setError('Failed to get AI suggestions. Make sure GOOGLE_API_KEY is configured in the backend.')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityIcon = (severity: Insight['severity']) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4" />
    }
  }

  if (!suggestions && !loading && !error) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">AI-Powered Suggestions</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Let AI analyze your data to suggest transformations and visualizations.
              </p>
            </div>
            <Button onClick={getSuggestions} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Analyze with AI
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Suggestions
          </CardTitle>
          <CardDescription>Intelligent insights and recommendations</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={getSuggestions} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-6 pt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is analyzing your data...</p>
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : suggestions ? (
          <>
            {/* Insights Section */}
            {suggestions.insights.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  Insights
                </h4>
                <div className="grid gap-3">
                  {suggestions.insights.map((insight, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-muted/50 rounded-lg text-sm border-l-4 border-l-primary/50">
                      <div className="mt-0.5">{getSeverityIcon(insight.severity)}</div>
                      <div>
                        <div className="font-semibold">{insight.title}</div>
                        <div className="text-muted-foreground">{insight.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operations Section */}
            {suggestions.operation_suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Suggested Operations
                </h4>
                <div className="grid gap-3">
                  {suggestions.operation_suggestions.map((op, i) => (
                    <div key={i} className="group flex items-start justify-between gap-3 p-3 border rounded-lg hover:border-primary/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{getOperationLabel(op.type)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{op.reason}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onApplyOperation?.({ type: op.type, params: op.params })}
                        title="Add to pipeline"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visualizations Section */}
            {suggestions.visualization_suggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  Visualization Ideas
                </h4>
                <div className="grid gap-3">
                  {suggestions.visualization_suggestions.map((viz, i) => (
                    <div key={i} className="group flex items-start justify-between gap-3 p-3 border rounded-lg hover:border-green-500/50 transition-colors">
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{viz.title}</div>
                        {viz.description && <p className="text-xs text-muted-foreground">{viz.description}</p>}
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px] py-0">{viz.type}</Badge>
                          {viz.x && <Badge variant="outline" className="text-[10px] py-0">X: {viz.x}</Badge>}
                          {viz.y && <Badge variant="outline" className="text-[10px] py-0">Y: {viz.y}</Badge>}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onApplyVisualization?.(viz)}
                        title="Generate chart"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RefreshCw({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  )
}
