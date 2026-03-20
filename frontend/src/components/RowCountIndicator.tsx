import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface RowCountIndicatorProps {
  originalCount: number
  currentCount: number
  operationName?: string
}

export function RowCountIndicator({
  originalCount,
  currentCount,
  operationName,
}: RowCountIndicatorProps) {
  const rowsChanged = currentCount - originalCount
  const percentChange =
    originalCount > 0 ? ((rowsChanged / originalCount) * 100).toFixed(1) : '0'

  const isReduction = rowsChanged < 0
  const isIncrease = rowsChanged > 0

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-semibold">
          {currentCount.toLocaleString()} rows
        </p>
        <p className="text-xs text-muted-foreground">
          of {originalCount.toLocaleString()} original
        </p>
      </div>

      {rowsChanged !== 0 && (
        <Badge
          variant={isReduction ? 'destructive' : isIncrease ? 'default' : 'secondary'}
          className="gap-1"
        >
          {isReduction && <TrendingDown className="h-3 w-3" />}
          {isIncrease && <TrendingUp className="h-3 w-3" />}
          {!isReduction && !isIncrease && <Minus className="h-3 w-3" />}
          {rowsChanged > 0 && '+'}
          {rowsChanged.toLocaleString()}
          <span className="text-xs">({percentChange}%)</span>
        </Badge>
      )}

      {operationName && (
        <p className="text-xs text-muted-foreground">
          after {operationName}
        </p>
      )}
    </div>
  )
}
