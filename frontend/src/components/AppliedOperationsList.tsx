import { Button } from '@/components/ui/button'
import { Plus, Trash2, ArrowUp, ArrowDown, Edit } from 'lucide-react'
import { type Operation } from '@/lib/api'

interface AppliedOperationsListProps {
  operations: Operation[]
  onRemove: (index: number) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onAddNew: () => void
  onEdit?: (index: number) => void
  columns: string[]
  minimized?: boolean
}

export function AppliedOperationsList({
  operations,
  onRemove,
  onReorder,
  onAddNew,
  onEdit,
  columns,
  minimized = false,
}: AppliedOperationsListProps) {
  const generateSummary = (op: Operation): string => {
    if (op.type === 'filter') {
      const operatorMap: Record<string, string> = {
        equals: '=',
        not_equals: '≠',
        greater_than: '>',
        less_than: '<',
        greater_equal: '≥',
        less_equal: '≤',
        contains: 'contains',
        not_contains: 'not contains',
        date_range: 'date range',
      }
      const opSymbol = operatorMap[op.params.operator] || op.params.operator
      if (op.params.operator === 'date_range') {
        return `${op.params.column} between ${op.params.value?.start} and ${op.params.value?.end}`
      }
      return `${op.params.column} ${opSymbol} ${op.params.value}`
    } else if (op.type === 'replace') {
      return `Replace "${op.params.oldValue}" with "${op.params.newValue}" in ${op.params.column}`
    } else if (op.type === 'math') {
      const opSymbol: Record<string, string> = {
        add: '+',
        subtract: '-',
        multiply: '×',
        divide: '÷',
      }
      const symbol = opSymbol[op.params.operation] || op.params.operation
      const colB = typeof op.params.colBOrValue === 'string' && columns.includes(op.params.colBOrValue)
        ? op.params.colBOrValue
        : op.params.colBOrValue
      return `${op.params.colA} ${symbol} ${colB} → ${op.params.newColumn}`
    } else if (op.type === 'sort') {
      const cols = (op.params.columns as { column: string; ascending: boolean }[]).map((c) => `${c.column} ${c.ascending ? '↑' : '↓'}`).join(', ')
      return `Sort by: ${cols}`
    } else if (op.type === 'select_columns') {
      return `Select columns: ${op.params.columns.join(', ')}`
    } else if (op.type === 'remove_duplicates') {
      const subset = op.params.subset ? ` (${op.params.subset.join(', ')})` : ''
      return `Remove duplicates${subset}`
    } else if (op.type === 'aggregate') {
      const aggs = Object.entries(op.params.aggregations).map(([col, op]) => `${col}: ${op}`).join(', ')
      const groupBy = op.params.groupBy?.length ? ` by ${op.params.groupBy.join(', ')}` : ''
      return `Aggregate${groupBy}: ${aggs}`
    } else if (op.type === 'text_cleanup') {
      return `Text cleanup on ${op.params.column}: ${op.params.operations.join(', ')}`
    } else if (op.type === 'split_column') {
      return `Split ${op.params.column} by "${op.params.separator}" → ${op.params.newColumns.join(', ')}`
    } else if (op.type === 'merge_columns') {
      return `Merge ${op.params.columns.join(', ')} → ${op.params.newColumn}`
    } else if (op.type === 'date_format') {
      return `Format ${op.params.column} as ${op.params.outputFormat}`
    } else if (op.type === 'remove_blank_rows') {
      const cols = op.params.columns ? ` (${op.params.columns.join(', ')})` : ''
      return `Remove blank rows${cols}`
    } else if (op.type === 'convert_to_numeric') {
      return `Convert ${op.params.column} to numeric`
    } else if (op.type === 'gross_profit') {
      return `Gross Profit: ${op.params.revenueColumn} - ${op.params.costOfGoodsSoldColumn} → ${op.params.newColumn}`
    } else if (op.type === 'net_profit') {
      return `Net Profit: ${op.params.grossProfitColumn} - ${op.params.expensesColumn} → ${op.params.newColumn}`
    } else if (op.type === 'profit_loss') {
      return `P&L (${op.params.period}): ${op.params.revenueColumn} - ${op.params.costColumn}`
    }
    return `${op.type} operation`
  }

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'filter':
        return <span className="text-blue-600">🔍</span>
      case 'sort':
        return <span className="text-purple-600">⇅</span>
      case 'replace':
        return <span className="text-orange-600">🔄</span>
      case 'math':
        return <span className="text-green-600">+</span>
      default:
        return <span className="text-gray-600">•</span>
    }
  }

  // Minimized state - show only header with count
  if (minimized) {
    return (
      <div className="px-4 py-2 border-b border-gray-300 bg-[#F2F2F2] transition-all duration-250 ease-out">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Applied Transformations</h3>
          <span className="text-xs text-gray-500">{operations.length} applied</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Applied Transformations</h3>
        <span className="text-xs text-gray-500">{operations.length} applied</span>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-300 rounded">
          <p>No transformations applied yet</p>
          <p className="text-xs mt-1">Click an operation from the sidebar to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {operations.map((op, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-white border border-gray-300 rounded hover:border-[#217346] transition-colors group"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 mt-0.5">
                  {getOperationIcon(op.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">
                      {index + 1}.
                    </span>
                    <span className="text-sm text-gray-800 truncate">
                      {generateSummary(op)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">
                    {op.type.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onEdit(index)}
                    title="Edit"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
                {index > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onReorder(index, index - 1)}
                    title="Move up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                )}
                {index < operations.length - 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => onReorder(index, index + 1)}
                    title="Move down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                  onClick={() => onRemove(index)}
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onAddNew}
        variant="outline"
        className="w-full border-dashed border-[#217346] text-[#217346] hover:bg-[#217346] hover:text-white"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Transformation
      </Button>
    </div>
  )
}

