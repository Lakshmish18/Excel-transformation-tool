import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { TrendingUp, DollarSign, Package, Users } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { aiApi, getApiErrorDetail } from '@/lib/api'
import { toast } from 'sonner'

interface AutoKPIsProps {
  data: Record<string, unknown>[]
  columns: string[]
}

export function AutoKPIs({ data, columns }: AutoKPIsProps) {
  const [explanation, setExplanation] = useState<string>('')
  const [showExplanation, setShowExplanation] = useState(false)
  const [isExplaining, setIsExplaining] = useState(false)

  if (!data?.length || !columns?.length) return null

  const explainKPIs = async () => {
    try {
      setIsExplaining(true)
      setShowExplanation(false)

      const res = await aiApi.explainInsight({
        dataContext: {
          data: data.slice(0, 5),
          columns,
        },
        insightType: 'kpi',
      })

      setExplanation(res.explanation)
      setShowExplanation(true)
    } catch (err: unknown) {
      toast.error(getApiErrorDetail(err))
    } finally {
      setIsExplaining(false)
    }
  }

  const numericColumns = columns.filter((col) => {
    const sample = data[0]?.[col]
    return typeof sample === 'number' || (typeof sample === 'string' && !isNaN(parseFloat(sample as string)))
  })

  const icons = [
    <DollarSign key="dollar" className="h-4 w-4" />,
    <Package key="package" className="h-4 w-4" />,
    <TrendingUp key="trend" className="h-4 w-4" />,
    <Users key="users" className="h-4 w-4" />,
  ]

  const kpis = numericColumns.slice(0, 4).map((col, i) => {
    const values = data.map((row) => {
      const v = row[col]
      if (typeof v === 'number') return v
      if (typeof v === 'string') return parseFloat(v) || 0
      return 0
    })
    const sum = values.reduce((a, b) => a + b, 0)
    return {
      label: col.replace(/_/g, ' ').toUpperCase(),
      value: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      icon: icons[i % icons.length],
    }
  })

  if (kpis.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Key Performance Indicators</h3>
        <Button
          onClick={() => void explainKPIs()}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isExplaining}
        >
          <Sparkles className="h-4 w-4" />
          {isExplaining ? 'Explaining...' : 'Explain KPIs'}
        </Button>
      </div>

      {showExplanation && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-sm text-emerald-900">{explanation}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
              <div className="text-muted-foreground">{kpi.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
