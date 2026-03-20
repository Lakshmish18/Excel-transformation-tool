/**
 * AutoCharts component: Automatically generates charts based on data analysis.
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { excelApi, type VisualizationSuggestion } from '@/lib/api'

interface AutoChartsProps {
  columns: string[]
  rows: Record<string, unknown>[]
}

interface ChartData {
  type: VisualizationSuggestion['type']
  title: string
  data: unknown[]
  x?: string
  y?: string
  category?: string
  value?: string
  column?: string
}

const COLORS = ['#217346', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444']

export function AutoCharts({ columns, rows }: AutoChartsProps) {
  const [charts, setCharts] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (columns.length > 0 && rows.length > 0) {
      generateCharts()
    } else {
      setLoading(false)
    }
  }, [columns, rows])

  const generateCharts = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get visualization suggestions from backend
      const result = await excelApi.analyzeData({ columns, rows })
      const vizSuggestions = result.visualizations

      const generatedCharts: ChartData[] = []

      for (const viz of vizSuggestions) {
        try {
          let chartData: ChartData | null = null

          if (viz.type === 'bar' && viz.category && viz.value) {
            const aggregated = aggregateData(rows, viz.category, viz.value)
            if (aggregated.length > 0) {
              chartData = {
                type: 'bar',
                title: viz.title,
                data: aggregated,
                category: viz.category,
                value: viz.value,
              }
            }
          } else if (viz.type === 'scatter' && viz.x && viz.y) {
            const scatterData = rows
              .filter((row) => row[viz.x!] != null && row[viz.y!] != null)
              .map((row) => ({
                x: Number(row[viz.x!]) || 0,
                y: Number(row[viz.y!]) || 0,
                name: `${row[viz.x!]}, ${row[viz.y!]}`,
              }))
              .slice(0, 100) // Limit to 100 points for performance

            if (scatterData.length > 0) {
              chartData = {
                type: 'scatter',
                title: viz.title,
                data: scatterData,
                x: viz.x,
                y: viz.y,
              }
            }
          } else if (viz.type === 'histogram' && viz.column) {
            const histogramData = createHistogramData(rows, viz.column)
            if (histogramData.length > 0) {
              chartData = {
                type: 'histogram',
                title: viz.title,
                data: histogramData,
                column: viz.column,
              }
            }
          } else if (viz.type === 'line' && viz.x && viz.y) {
            const lineData = rows
              .filter((row) => row[viz.x!] != null && row[viz.y!] != null)
              .map((row) => ({
                name: String(row[viz.x!]),
                value: Number(row[viz.y!]) || 0,
              }))
              .slice(0, 50) // Limit for performance

            if (lineData.length > 0) {
              chartData = {
                type: 'line',
                title: viz.title,
                data: lineData,
                x: viz.x,
                y: viz.y,
              }
            }
          } else if (viz.type === 'pie' && viz.category && viz.value) {
            const pieData = aggregateData(rows, viz.category, viz.value)
            if (pieData.length > 0 && pieData.length <= 10) {
              chartData = {
                type: 'pie',
                title: viz.title,
                data: pieData,
                category: viz.category,
                value: viz.value,
              }
            }
          }

          if (chartData) {
            generatedCharts.push(chartData)
          }
        } catch (err) {
          if (import.meta.env.DEV) console.warn(`Failed to generate chart for ${viz.type}:`, err)
        }
      }

      setCharts(generatedCharts)
    } catch (err) {
      console.error('Chart generation error:', err)
      setError('Failed to generate charts')
    } finally {
      setLoading(false)
    }
  }

  const aggregateData = (
    rows: Record<string, unknown>[],
    categoryCol: string,
    valueCol: string
  ): Array<{ name: string; value: number }> => {
    const grouped = rows.reduce((acc: Record<string, number>, row: Record<string, unknown>) => {
      const cat = String(row[categoryCol] ?? 'Unknown')
      if (!acc[cat]) acc[cat] = 0
      acc[cat] += Number(row[valueCol]) || 0
      return acc
    }, {} as Record<string, number>)

    return (Object.entries(grouped) as [string, number][])
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20) // Limit to top 20 categories
  }

  const createHistogramData = (
    rows: Record<string, unknown>[],
    column: string
  ): Array<{ name: string; value: number }> => {
    const values = rows
      .map((row) => Number(row[column]))
      .filter((v) => !isNaN(v) && v != null)

    if (values.length === 0) return []

    const min = Math.min(...values)
    const max = Math.max(...values)
    const bins = 10
    const binWidth = (max - min) / bins

    const binsData: Record<string, number> = {}
    for (let i = 0; i < bins; i++) {
      const binStart = min + i * binWidth
      const binEnd = binStart + binWidth
      binsData[`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`] = 0
    }

    values.forEach((value) => {
      const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1)
      const binStart = min + binIndex * binWidth
      const binEnd = binStart + binWidth
      const binKey = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`
      binsData[binKey] = (binsData[binKey] || 0) + 1
    })

    return Object.entries(binsData).map(([name, value]) => ({ name, value }))
  }

  if (columns.length === 0 || rows.length === 0) {
    return null
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span>
            Visualizations
          </CardTitle>
          <CardDescription>Automatically generated charts based on your data</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Generating charts...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{error}</div>
          ) : charts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No suitable visualizations found for this data.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {charts.map((chart, i) => (
                <Card key={i} className="p-4">
                  <h3 className="font-semibold mb-4 text-sm">{chart.title}</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    {chart.type === 'bar' && (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[0]} />
                      </BarChart>
                    )}
                    {chart.type === 'scatter' && (
                      <ScatterChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" name={chart.x} />
                        <YAxis dataKey="y" name={chart.y} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter dataKey="y" fill={COLORS[1]} />
                      </ScatterChart>
                    )}
                    {chart.type === 'histogram' && (
                      <BarChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill={COLORS[2]} />
                      </BarChart>
                    )}
                    {chart.type === 'line' && (
                      <LineChart data={chart.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="value" stroke={COLORS[3]} strokeWidth={2} />
                      </LineChart>
                    )}
                    {chart.type === 'pie' && (
                      <PieChart>
                        <Pie
                          data={chart.data}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {chart.data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
