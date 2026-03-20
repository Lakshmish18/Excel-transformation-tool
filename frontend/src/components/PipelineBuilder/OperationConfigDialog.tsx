/**
 * Dialog for configuring a single pipeline operation (add or edit).
 */
import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { Operation } from '@/lib/api'
import { getOperationLabel } from './operationsConfig'
import { SmartColumnSelector } from '@/components/SmartColumnSelector'
import { validateOperation } from '@/lib/operationValidator'
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

function getDefaultParams(type: string, columns: string[]): Record<string, unknown> {
  switch (type) {
    case 'filter':
      return { column: columns[0] || '', operator: 'equals', value: '' }
    case 'replace':
      return { column: columns[0] || '', oldValue: '', newValue: '', caseSensitive: false }
    case 'math':
      return { operation: 'add', colA: columns[0] || '', colBOrValue: '', newColumn: '' }
    case 'sort':
      return { column: columns[0] || '', ascending: true }
    case 'select_columns':
      return { columns: columns.length ? [columns[0]] : [] }
    case 'remove_duplicates':
      return { subset: undefined, keep: 'first' }
    case 'remove_blank_rows':
      return { columns: undefined }
    case 'text_cleanup':
      return { column: columns[0] || '', operations: ['trim'] }
    case 'date_format':
      return { column: columns[0] || '', outputFormat: 'YYYY-MM-DD' }
    case 'split_column':
      return { column: columns[0] || '', separator: ',', newColumns: ['Col1', 'Col2'] }
    case 'merge_columns':
      return { columns: columns.length >= 2 ? [columns[0], columns[1]] : columns.slice(0, 2), newColumn: 'Merged', separator: ' ' }
    case 'aggregate':
      return { groupBy: [], aggregations: columns[0] ? { [columns[0]]: 'sum' } : {} }
    case 'gross_profit':
      return { revenueColumn: columns[0] || '', costOfGoodsSoldColumn: columns[1] || '', newColumn: 'Gross Profit' }
    case 'net_profit':
      return { grossProfitColumn: columns[0] || '', expensesColumn: columns[1] || '', newColumn: 'Net Profit' }
    case 'profit_loss':
      return { dateColumn: columns[0] || '', revenueColumn: columns[1] || '', costColumn: columns[2] || '', period: 'monthly' }
    case 'convert_to_numeric':
      return { column: columns[0] || '', errors: 'coerce' }
    default:
      return {}
  }
}

function buildOperationFromParams(type: string, params: Record<string, unknown>): Operation | null {
  switch (type) {
    case 'filter': {
      if (!params.column || params.value === '') return null
      const val = params.value
      return {
        type: 'filter',
        params: {
          column: params.column,
          operator: params.operator || 'equals',
          value: typeof val === 'string' && !isNaN(Number(val)) ? Number(val) : val,
        },
      }
    }
    case 'replace':
      if (!params.column) return null
      return {
        type: 'replace',
        params: {
          column: params.column,
          oldValue: params.oldValue ?? '',
          newValue: params.newValue ?? '',
        },
      }
    case 'math': {
      if (!params.operation || !params.colA || (params.colBOrValue as string) === '' || !params.newColumn) return null
      const bOrVal = params.colBOrValue
      return {
        type: 'math',
        params: {
          operation: params.operation,
          colA: params.colA,
          colBOrValue: typeof bOrVal === 'string' && !isNaN(Number(bOrVal)) ? Number(bOrVal) : bOrVal,
          newColumn: params.newColumn,
        },
      }
    }
    case 'sort':
      if (!params.column) return null
      return {
        type: 'sort',
        params: {
          columns: [{ column: params.column, ascending: params.ascending !== false }],
        },
      }
    case 'select_columns':
      if (!Array.isArray(params.columns) || params.columns.length === 0) return null
      return { type: 'select_columns', params: { columns: params.columns } }
    case 'remove_duplicates':
      return {
        type: 'remove_duplicates',
        params: {
          ...(params.subset ? { subset: params.subset } : {}),
          ...(params.keep ? { keep: params.keep } : {}),
        },
      }
    case 'remove_blank_rows':
      return {
        type: 'remove_blank_rows',
        params: params.columns ? { columns: params.columns } : {},
      }
    case 'text_cleanup':
      if (!params.column || !Array.isArray(params.operations) || params.operations.length === 0) return null
      return { type: 'text_cleanup', params: { column: params.column, operations: params.operations } }
    case 'date_format':
      if (!params.column || !params.outputFormat) return null
      return { type: 'date_format', params: { column: params.column, outputFormat: params.outputFormat } }
    case 'split_column':
      if (!params.column || !params.separator || !Array.isArray(params.newColumns) || params.newColumns.length === 0) return null
      return {
        type: 'split_column',
        params: { column: params.column, separator: params.separator, newColumns: params.newColumns },
      }
    case 'merge_columns':
      if (!Array.isArray(params.columns) || params.columns.length < 2 || !params.newColumn) return null
      return {
        type: 'merge_columns',
        params: {
          columns: params.columns,
          newColumn: params.newColumn,
          ...(params.separator ? { separator: params.separator } : {}),
        },
      }
    case 'aggregate':
      if (!params.aggregations || typeof params.aggregations !== 'object' || Object.keys(params.aggregations as object).length === 0) return null
      return {
        type: 'aggregate',
        params: {
          groupBy: Array.isArray(params.groupBy) ? params.groupBy : [],
          aggregations: params.aggregations as Record<string, string>,
        },
      }
    case 'gross_profit':
      if (!params.revenueColumn || !params.costOfGoodsSoldColumn || !params.newColumn) return null
      return {
        type: 'gross_profit',
        params: {
          revenueColumn: params.revenueColumn,
          costOfGoodsSoldColumn: params.costOfGoodsSoldColumn,
          newColumn: params.newColumn,
        },
      }
    case 'net_profit':
      if (!params.grossProfitColumn || !params.expensesColumn || !params.newColumn) return null
      return {
        type: 'net_profit',
        params: {
          grossProfitColumn: params.grossProfitColumn,
          expensesColumn: params.expensesColumn,
          newColumn: params.newColumn,
        },
      }
    case 'profit_loss':
      if (!params.dateColumn || !params.revenueColumn || !params.costColumn || !params.period) return null
      return {
        type: 'profit_loss',
        params: {
          dateColumn: params.dateColumn,
          revenueColumn: params.revenueColumn,
          costColumn: params.costColumn,
          period: params.period,
        },
      }
    case 'convert_to_numeric':
      if (!params.column) return null
      return {
        type: 'convert_to_numeric',
        params: { column: params.column, ...(params.errors ? { errors: params.errors } : {}) },
      }
    default:
      return null
  }
}

function summaryFromOperation(op: Operation): string {
  const p = op.params
  switch (op.type) {
    case 'filter':
      return `${p.column} ${p.operator} ${p.value}`
    case 'replace':
      return `Replace "${p.oldValue}" with "${p.newValue}" in ${p.column}`
    case 'math':
      return `${p.colA} ${p.operation} ${p.colBOrValue} → ${p.newColumn}`
    case 'sort':
      return `Sort by ${(p.columns as { column: string; ascending: boolean }[]).map((c: { column: string; ascending: boolean }) => `${c.column} ${c.ascending ? '↑' : '↓'}`).join(', ')}`
    case 'select_columns':
      return `Columns: ${(p.columns as string[]).join(', ')}`
    case 'remove_duplicates':
      return (p.subset as string[] | undefined)?.length ? `Subset: ${(p.subset as string[]).join(', ')}` : 'All columns'
    case 'remove_blank_rows':
      return (p.columns as string[] | undefined)?.length ? `Columns: ${(p.columns as string[]).join(', ')}` : 'All columns'
    case 'text_cleanup':
      return `${p.column}: ${(p.operations as string[]).join(', ')}`
    case 'date_format':
      return `${p.column} → ${p.outputFormat}`
    case 'split_column':
      return `${p.column} by "${p.separator}" → ${(p.newColumns as string[]).join(', ')}`
    case 'merge_columns':
      return `${(p.columns as string[]).join(', ')} → ${p.newColumn}`
    case 'aggregate': {
      const agg = p.aggregations as Record<string, string>
      const aggs = Object.entries(agg).map(([c, o]) => `${c}: ${o}`).join(', ')
      return (p.groupBy as string[]).length ? `Group by ${(p.groupBy as string[]).join(', ')} → ${aggs}` : aggs
    }
    case 'gross_profit':
      return `${p.revenueColumn} - ${p.costOfGoodsSoldColumn} → ${p.newColumn}`
    case 'net_profit':
      return `${p.grossProfitColumn} - ${p.expensesColumn} → ${p.newColumn}`
    case 'profit_loss':
      return `P&L (${p.period}): ${p.revenueColumn} - ${p.costColumn}`
    case 'convert_to_numeric':
      return `Convert ${p.column} to number`
    default:
      return op.type
  }
}

interface OperationConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  operationType: string | null
  initialParams?: Record<string, unknown>
  columns: string[]
  /** Columns available at this step (for edit: columns after previous ops). Defaults to columns. */
  availableColumns?: string[]
  mode: 'add' | 'edit'
  onSave: (op: Operation) => void
}

const TEXT_CLEANUP_OPTIONS = [
  { id: 'trim', label: 'Trim whitespace' },
  { id: 'lowercase', label: 'Lowercase' },
  { id: 'uppercase', label: 'Uppercase' },
  { id: 'remove_symbols', label: 'Remove symbols' },
]

const AGGREGATION_OPS = ['sum', 'mean', 'average', 'count', 'min', 'max', 'std', 'median']

export function OperationConfigDialog({
  open,
  onOpenChange,
  operationType,
  initialParams,
  columns,
  availableColumns: availableColumnsProp,
  mode,
  onSave,
}: OperationConfigDialogProps) {
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [liveValidation, setLiveValidation] = useState<{ status: 'valid' | 'warning' | 'error'; message?: string } | null>(null)

  const availableColumns = availableColumnsProp ?? columns

  useEffect(() => {
    if (open && operationType) {
      setParams(initialParams ?? getDefaultParams(operationType, columns))
      setError(null)
      setLiveValidation(null)
    }
  }, [open, operationType, initialParams, columns])

  useEffect(() => {
    if (!open || !operationType) return
    const t = setTimeout(() => {
      const op = buildOperationFromParams(operationType, params)
      if (!op) {
        setLiveValidation(null)
        return
      }
      const result = validateOperation(op, availableColumns, 0, [])
      setLiveValidation({ status: result.status, message: result.message })
    }, 500)
    return () => clearTimeout(t)
  }, [open, operationType, params, availableColumns])

  const update = (key: string, value: unknown) => {
    setParams((p) => ({ ...p, [key]: value }))
    setError(null)
  }

  const handleSubmit = () => {
    if (!operationType) return
    const op = buildOperationFromParams(operationType, params)
    if (!op) {
      setError('Please fill all required fields.')
      return
    }
    if (liveValidation?.status === 'error') {
      setError(liveValidation.message ?? 'Fix validation errors.')
      return
    }
    onSave(op)
    onOpenChange(false)
  }

  if (!operationType) return null

  const title = mode === 'add' ? `Configure ${getOperationLabel(operationType)}` : `Edit ${getOperationLabel(operationType)}`
  const submitLabel = mode === 'add' ? 'Add to Pipeline' : 'Save Changes'
  const builtOp = buildOperationFromParams(operationType, params)
  const hasErrors = liveValidation?.status === 'error'
  const canSubmit = !!builtOp && !hasErrors

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Set parameters for this operation.</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Validation error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2">
          {/* Filter */}
          {operationType === 'filter' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Operator</Label>
                <Select value={String(params.operator || 'equals')} onValueChange={(v) => update('operator', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals (=)</SelectItem>
                    <SelectItem value="not_equals">Not equals (≠)</SelectItem>
                    <SelectItem value="greater_than">Greater than (&gt;)</SelectItem>
                    <SelectItem value="less_than">Less than (&lt;)</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="not_contains">Not contains</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Value</Label>
                <Input
                  value={String(params.value ?? '')}
                  onChange={(e) => update('value', e.target.value)}
                  placeholder="Value to compare"
                />
              </div>
            </>
          )}

          {/* Replace */}
          {operationType === 'replace' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Find</Label>
                <Input
                  value={String(params.oldValue ?? '')}
                  onChange={(e) => update('oldValue', e.target.value)}
                  placeholder="Value to find"
                />
              </div>
              <div>
                <Label>Replace with</Label>
                <Input
                  value={String(params.newValue ?? '')}
                  onChange={(e) => update('newValue', e.target.value)}
                  placeholder="Replacement value"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={Boolean(params.caseSensitive)}
                  onCheckedChange={(v) => update('caseSensitive', v)}
                />
                <Label>Case sensitive</Label>
              </div>
            </>
          )}

          {/* Math */}
          {operationType === 'math' && (
            <>
              <div>
                <Label>Operator</Label>
                <Select value={String(params.operation || 'add')} onValueChange={(v) => update('operation', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add (+)</SelectItem>
                    <SelectItem value="subtract">Subtract (-)</SelectItem>
                    <SelectItem value="multiply">Multiply (×)</SelectItem>
                    <SelectItem value="divide">Divide (÷)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Column A</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.colA || '')}
                  onValueChange={(v) => update('colA', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Column B or value</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={columns.includes(String(params.colBOrValue ?? '')) ? String(params.colBOrValue ?? '') : ''}
                  onValueChange={(v) => update('colBOrValue', v)}
                  placeholder="Select column (optional)"
                />
                <Input
                  className="mt-2"
                  value={String(params.colBOrValue ?? '')}
                  onChange={(e) => update('colBOrValue', e.target.value)}
                  placeholder="Or type a number (e.g. 10)"
                />
              </div>
              <div>
                <Label>Result column name</Label>
                <Input
                  value={String(params.newColumn ?? '')}
                  onChange={(e) => update('newColumn', e.target.value)}
                  placeholder="New column name"
                />
              </div>
            </>
          )}

          {/* Sort */}
          {operationType === 'sort' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Order</Label>
                <RadioGroup
                  value={params.ascending === false ? 'desc' : 'asc'}
                  onValueChange={(v) => update('ascending', v === 'asc')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="asc" id="sort-asc" />
                    <Label htmlFor="sort-asc">Ascending</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="desc" id="sort-desc" />
                    <Label htmlFor="sort-desc">Descending</Label>
                  </div>
                </RadioGroup>
              </div>
            </>
          )}

          {/* Select columns */}
          {operationType === 'select_columns' && (
            <div>
              <Label>Columns to keep</Label>
              <SmartColumnSelector
                columns={columns}
                value={(params.columns as string[] | undefined) ?? []}
                onValueChange={(v) => update('columns', v)}
                allowMultiple
                placeholder="Select columns"
              />
            </div>
          )}

          {/* Remove duplicates */}
          {operationType === 'remove_duplicates' && (
            <div>
              <Label>Subset columns (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Leave empty to use all columns.</p>
              <SmartColumnSelector
                columns={columns}
                value={(params.subset as string[] | undefined) ?? []}
                onValueChange={(v) => update('subset', v.length ? v : undefined)}
                allowMultiple
                placeholder="Select columns (optional)"
              />
            </div>
          )}

          {/* Remove blank rows */}
          {operationType === 'remove_blank_rows' && (
            <div>
              <Label>Columns to check (optional)</Label>
              <p className="text-xs text-muted-foreground mb-2">Leave empty to check all columns.</p>
              <SmartColumnSelector
                columns={columns}
                value={(params.columns as string[] | undefined) ?? []}
                onValueChange={(v) => update('columns', v.length ? v : undefined)}
                allowMultiple
                placeholder="Select columns (optional)"
              />
            </div>
          )}

          {/* Text cleanup */}
          {operationType === 'text_cleanup' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Operations</Label>
                <div className="space-y-2">
                  {TEXT_CLEANUP_OPTIONS.map((opt) => {
                    const list = (params.operations as string[]) || []
                    const checked = list.includes(opt.id)
                    return (
                      <div key={opt.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`tc-${opt.id}`}
                          checked={checked}
                          onChange={(e) => {
                            const newList = list.slice()
                            if (e.target.checked) newList.push(opt.id)
                            else newList.splice(newList.indexOf(opt.id), 1)
                            update('operations', newList.length ? newList : ['trim'])
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <Label htmlFor={`tc-${opt.id}`} className="font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Date format */}
          {operationType === 'date_format' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Output format</Label>
                <Select value={String(params.outputFormat || 'YYYY-MM-DD')} onValueChange={(v) => update('outputFormat', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Split column */}
          {operationType === 'split_column' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Separator</Label>
                <Input
                  value={String(params.separator ?? ',')}
                  onChange={(e) => update('separator', e.target.value)}
                  placeholder="e.g. , or |"
                />
              </div>
              <div>
                <Label>New column names (comma-separated)</Label>
                <Input
                  value={Array.isArray(params.newColumns) ? params.newColumns.join(', ') : ''}
                  onChange={(e) => update('newColumns', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                  placeholder="Col1, Col2, Col3"
                />
              </div>
            </>
          )}

          {/* Merge columns */}
          {operationType === 'merge_columns' && (
            <>
              <div>
                <Label>Columns to merge (select at least 2)</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={(params.columns as string[] | undefined) ?? []}
                  onValueChange={(v) => update('columns', v)}
                  allowMultiple
                  placeholder="Select columns"
                />
              </div>
              <div>
                <Label>New column name</Label>
                <Input
                  value={String(params.newColumn ?? '')}
                  onChange={(e) => update('newColumn', e.target.value)}
                  placeholder="Merged"
                />
              </div>
              <div>
                <Label>Separator (optional)</Label>
                <Input
                  value={String(params.separator ?? ' ')}
                  onChange={(e) => update('separator', e.target.value)}
                  placeholder=" "
                />
              </div>
            </>
          )}

          {/* Aggregate - simplified: one groupBy column, one agg column + op */}
          {operationType === 'aggregate' && (
            <>
              <div>
                <Label>Group by column (optional)</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={(params.groupBy as string[] | undefined) ?? []}
                  onValueChange={(v) => update('groupBy', v)}
                  allowMultiple
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Aggregate column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={Object.keys((params.aggregations as Record<string, string>) || {})[0] || ''}
                  onValueChange={(col) => {
                    const agg = (params.aggregations as Record<string, string>) || {}
                    const op = agg[col] || 'sum'
                    update('aggregations', { [col]: op })
                  }}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Aggregation</Label>
                <Select
                  value={Object.values((params.aggregations as Record<string, string>) || {})[0] || 'sum'}
                  onValueChange={(op) => {
                    const agg = (params.aggregations as Record<string, string>) || {}
                    const col = Object.keys(agg)[0]
                    if (col) update('aggregations', { [col]: op })
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Gross profit */}
          {operationType === 'gross_profit' && (
            <>
              <div>
                <Label>Revenue column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.revenueColumn || '')}
                  onValueChange={(v) => update('revenueColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Cost of goods sold column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.costOfGoodsSoldColumn || '')}
                  onValueChange={(v) => update('costOfGoodsSoldColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>New column name</Label>
                <Input
                  value={String(params.newColumn ?? '')}
                  onChange={(e) => update('newColumn', e.target.value)}
                  placeholder="Gross Profit"
                />
              </div>
            </>
          )}

          {/* Net profit */}
          {operationType === 'net_profit' && (
            <>
              <div>
                <Label>Gross profit column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.grossProfitColumn || '')}
                  onValueChange={(v) => update('grossProfitColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Expenses column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.expensesColumn || '')}
                  onValueChange={(v) => update('expensesColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>New column name</Label>
                <Input
                  value={String(params.newColumn ?? '')}
                  onChange={(e) => update('newColumn', e.target.value)}
                  placeholder="Net Profit"
                />
              </div>
            </>
          )}

          {/* Profit & Loss */}
          {operationType === 'profit_loss' && (
            <>
              <div>
                <Label>Date column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.dateColumn || '')}
                  onValueChange={(v) => update('dateColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Revenue column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.revenueColumn || '')}
                  onValueChange={(v) => update('revenueColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Cost column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.costColumn || '')}
                  onValueChange={(v) => update('costColumn', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>Period</Label>
                <Select value={String(params.period || 'monthly')} onValueChange={(v) => update('period', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Convert to numeric */}
          {operationType === 'convert_to_numeric' && (
            <>
              <div>
                <Label>Column</Label>
                <SmartColumnSelector
                  columns={columns}
                  value={String(params.column || '')}
                  onValueChange={(v) => update('column', v)}
                  placeholder="Select column"
                />
              </div>
              <div>
                <Label>On error</Label>
                <Select value={String(params.errors || 'coerce')} onValueChange={(v) => update('errors', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coerce">Coerce to NaN</SelectItem>
                    <SelectItem value="raise">Raise</SelectItem>
                    <SelectItem value="ignore">Ignore</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

        </div>

        {builtOp && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{summaryFromOperation(builtOp)}</p>
          </div>
        )}

        {liveValidation && (
          <div
            className={cn(
              'rounded-md border p-3 text-sm',
              liveValidation.status === 'valid' && 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20',
              liveValidation.status === 'warning' && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
              liveValidation.status === 'error' && 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20'
            )}
          >
            <div className="flex items-center gap-2">
              {liveValidation.status === 'valid' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-green-700 dark:text-green-400">Ready to add</span>
                </>
              )}
              {liveValidation.status === 'warning' && (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">{liveValidation.message ?? 'Warning'}</span>
                </>
              )}
              {liveValidation.status === 'error' && (
                <>
                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  <span className="text-red-700 dark:text-red-400">{liveValidation.message ?? 'Fix errors'}</span>
                </>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className={cn(canSubmit && 'bg-[#217346] hover:bg-[#1a5a38]')}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
