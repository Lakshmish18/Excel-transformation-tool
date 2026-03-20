/**
 * Dashboard: aggregated metrics and recent activity
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileSpreadsheet, Zap, TrendingUp, Clock } from 'lucide-react'
import { loadTransformationHistory } from '@/lib/supabase-history'
import { loadPipelines } from '@/lib/supabase-pipelines'

export function DashboardPage() {
  const [stats, setStats] = useState({
    totalTransformations: 0,
    totalPipelines: 0,
    totalRowsProcessed: 0,
    avgTransformTime: 0,
  })
  const [recentHistory, setRecentHistory] = useState<Array<{
    id: string
    file_name: string
    created_at: string
    row_count_after?: number
  }>>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [history, pipelines] = await Promise.all([
          loadTransformationHistory(100),
          loadPipelines(),
        ])
        const totalTransformations = history.length
        const totalRowsProcessed =
          history.reduce((sum, t) => sum + (t.row_count_after ?? 0), 0) || 0
        setStats({
          totalTransformations,
          totalPipelines: pipelines.length,
          totalRowsProcessed,
          avgTransformTime: 0,
        })
        setRecentHistory(
          history.slice(0, 5).map((h) => ({
            id: h.id,
            file_name: h.file_name,
            created_at: h.created_at,
            row_count_after: h.row_count_after,
          }))
        )
      } catch {
        setStats({
          totalTransformations: 0,
          totalPipelines: 0,
          totalRowsProcessed: 0,
          avgTransformTime: 0,
        })
      }
    }
    loadStats()
  }, [])

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transformations
            </CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransformations}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saved Pipelines</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPipelines}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Rows Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalRowsProcessed.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgTransformTime}s</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Transformations</CardTitle>
          <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {recentHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No transformations yet. Upload a file and run a pipeline to get
              started.
            </p>
          ) : (
            <ul className="space-y-2">
              {recentHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="truncate">{h.file_name}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">
                    {h.row_count_after != null
                      ? `${h.row_count_after.toLocaleString()} rows`
                      : ''}{' '}
                    · {new Date(h.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
