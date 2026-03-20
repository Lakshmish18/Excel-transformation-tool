import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ColumnProfilerProps {
  column: string
  data: Record<string, unknown>[]
}

export function ColumnProfiler({ column, data }: ColumnProfilerProps) {
  const values = data.map((row) => row[column])
  const totalValues = values.length
  const nullCount = values.filter((v) => v === null || v === undefined).length
  const uniqueCount = new Set(values).size
  const sample = values[0]
  const isNumeric = typeof sample === 'number' || (typeof sample === 'string' && !isNaN(parseFloat(sample as string)))

  let numericStats: { sum: string; average: string; median: string; min: string; max: string } | null = null
  if (isNumeric) {
    const numbers = values
      .filter((v) => v != null && v !== '')
      .map((v) => (typeof v === 'number' ? v : parseFloat(String(v)) || 0))
    if (numbers.length > 0) {
      const sum = numbers.reduce((a, b) => a + b, 0)
      const avg = sum / numbers.length
      const sorted = [...numbers].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      numericStats = {
        sum: sum.toFixed(2),
        average: avg.toFixed(2),
        median: median.toFixed(2),
        min: Math.min(...numbers).toFixed(2),
        max: Math.max(...numbers).toFixed(2),
      }
    }
  }

  const distribution = Object.entries(
    values.reduce<Record<string, number>>((acc, val) => {
      const key = String(val ?? '(null)')
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  )
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 10)
    .map(([name, count]) => ({
      name: name.length > 20 ? name.substring(0, 20) + '…' : name,
      count: count as number,
      percentage: (((count as number) / totalValues) * 100).toFixed(1),
    }))

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-4">Column: {column}</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-muted rounded-md">
          <p className="text-2xl font-bold">{totalValues}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-center p-2 bg-muted rounded-md">
          <p className="text-2xl font-bold">{uniqueCount}</p>
          <p className="text-xs text-muted-foreground">Unique</p>
        </div>
        <div className="text-center p-2 bg-muted rounded-md">
          <p className="text-2xl font-bold">{nullCount}</p>
          <p className="text-xs text-muted-foreground">Null</p>
        </div>
      </div>
      {numericStats && (
        <div className="space-y-2 mb-4">
          <p className="text-sm"><strong>Sum:</strong> {numericStats.sum}</p>
          <p className="text-sm"><strong>Average:</strong> {numericStats.average}</p>
          <p className="text-sm"><strong>Median:</strong> {numericStats.median}</p>
          <p className="text-sm"><strong>Range:</strong> {numericStats.min} - {numericStats.max}</p>
        </div>
      )}
      {distribution.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2">Top Values:</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distribution}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Bar dataKey="count" fill="#217346" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
