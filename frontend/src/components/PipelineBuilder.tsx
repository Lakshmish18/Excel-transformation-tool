import { useState, useReducer, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Plus, Sparkles, CheckCircle2, XCircle, Loader2, Play, ShieldCheck, ArrowUp, ArrowDown, Edit, Trash2,
  Undo2, Redo2, History, BookmarkPlus, FolderOpen, Download, Upload, MoreHorizontal,
  AlertTriangle,
} from 'lucide-react'
import { HelpTooltip } from '@/components/HelpTooltip'
import {
  getAvailableColumnsAtStep,
  validateOperation,
  type ValidationResult,
} from '@/lib/operationValidator'
import { excelApi, aiApi, getApiErrorDetail, type Operation, type TransformResponse, type ValidatePipelineResponse } from '@/lib/api'
import { SkeletonPipeline } from '@/components/skeletons'
import { TransformProgress } from '@/components/TransformProgress'
import { OperationCategoryDialog } from '@/components/PipelineBuilder/OperationCategoryDialog'
import { OperationConfigDialog } from '@/components/PipelineBuilder/OperationConfigDialog'
import {
  pipelineHistoryReducer,
  initialHistoryState,
  toApiOperations,
  type PipelineOperation,
} from '@/components/PipelineBuilder/pipelineHistoryReducer'
import { SavePipelineDialog } from '@/components/SavePipelineDialog'
import { LoadPipelineDialog } from '@/components/LoadPipelineDialog'
import { HistoryTimeline } from '@/components/HistoryTimeline'
import {
  getCurrentDraft,
  setCurrentDraft,
  clearCurrentDraft,
} from '@/lib/storage'
import { useAutoSave } from '@/hooks/useAutoSave'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useProfile } from '@/context/ProfileContext'

interface PipelineBuilderProps {
  fileId: string
  sheetName: string
  columns: string[]
  onTransformSuccess: (data: TransformResponse) => void
  onError?: (error: string) => void
  selectedOperationType?: string
  /**
   * Optional: when `seedKey` changes, the builder will replace its current pipeline
   * with `seedOperations`. This is used for AI "Apply Suggested Pipeline".
   */
  seedOperations?: Operation[]
  seedKey?: string | number
  /** Optional: notify parent when operations change (e.g. for batch mode) */
  onOperationsChange?: (operations: Operation[]) => void
  /** When true, hide Run & Preview button (parent handles execution, e.g. batch) */
  batchMode?: boolean
  /** Initial operations when loading a saved pipeline (e.g. from URL ?load=id) */
  initialOperations?: Operation[]
}

function opsToPipelineOps(
  ops: Operation[],
  generateSummary: (op: Operation) => string
): PipelineOperation[] {
  return ops.map((op) => ({
    ...op,
    id: `op-${Date.now()}-${Math.random()}`,
    summary: generateSummary(op),
  }))
}

export function PipelineBuilder({
  fileId,
  sheetName,
  columns,
  onTransformSuccess,
  onError,
  selectedOperationType: _selectedOperationType,
  seedOperations,
  seedKey,
  onOperationsChange,
  batchMode = false,
  initialOperations,
}: PipelineBuilderProps) {
  const [historyState, dispatch] = useReducer(pipelineHistoryReducer, initialHistoryState)
  const operations = historyState.present

  const { profile, config } = useProfile()

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidatePipelineResponse | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<string>('')
  const [isAiSuggesting, setIsAiSuggesting] = useState(false)

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [configOperationType, setConfigOperationType] = useState<string | null>(null)
  const [configInitialParams, setConfigInitialParams] = useState<Record<string, unknown> | undefined>(undefined)
  const [configMode, setConfigMode] = useState<'add' | 'edit'>('add')

  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [loadDialogOpen, setLoadDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [draftRestoreOpen, setDraftRestoreOpen] = useState(false)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [importFileRef, setImportFileRef] = useState<HTMLInputElement | null>(null)
  const initialLoadDone = useRef(false)
  const draftChecked = useRef(false)

  // Generate summary for an operation
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

  // If AI (or other flows) wants to replace the current pipeline after mount,
  // do it when `seedKey` changes.
  const lastSeedKeyRef = useRef<string | number | undefined>(undefined)
  useEffect(() => {
    if (seedKey === undefined) return
    if (lastSeedKeyRef.current === seedKey) return
    lastSeedKeyRef.current = seedKey

    const nextOps = seedOperations ?? []
    const pipelineOps = nextOps.length ? opsToPipelineOps(nextOps, generateSummary) : []

    if (nextOps.length) {
      dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
    } else {
      dispatch({ type: 'CLEAR_PIPELINE' })
    }

    setValidationResult(null)
    setEditingIndex(null)
  }, [seedKey, seedOperations, columns])

  // AI suggestion banner (debounced).
  useEffect(() => {
    if (!config.features.showAutoAnalysis) return
    if (batchMode) return
    if (columns.length === 0) return

    if (operations.length === 0) {
      setAiSuggestion('')
      return
    }

    const t = window.setTimeout(async () => {
      try {
        setIsAiSuggesting(true)
        const res = await aiApi.suggestNextStep({
          stage: 'pipeline_building',
          dataSummary: { columns },
          currentPipeline: toApiOperations(operations),
          userProfile: profile,
        })
        setAiSuggestion(res.suggestion || '')
      } catch (err: unknown) {
        // Keep it quiet; the rest of the UI already provides inline error handling.
        if (import.meta.env.DEV) console.warn('AI suggest failed:', err)
        setAiSuggestion('')
      } finally {
        setIsAiSuggesting(false)
      }
    }, 800)

    return () => {
      window.clearTimeout(t)
    }
  }, [operations, columns, config.features.showAutoAnalysis, batchMode, profile])

  const firstErrorCardRef = useRef<HTMLDivElement>(null)

  const validationResults: ValidationResult[] = useMemo(() => {
    return operations.map((op, i) => {
      const available = getAvailableColumnsAtStep(operations, i - 1, columns)
      return validateOperation(op, available, i, operations)
    })
  }, [operations, columns])

  const hasValidationErrors = validationResults.some((r) => r.status === 'error')
  const errorCount = validationResults.filter((r) => r.status === 'error').length

  const applySuggestion = useCallback(
    (opIndex: number, suggestion: { action: string; data?: { column?: string; field?: string; afterIndex?: number } }) => {
      const op = operations[opIndex]
      if (!op) return
      if (suggestion.action === 'use-column' && suggestion.data?.column && suggestion.data?.field) {
        const field = suggestion.data.field
        const updated = { ...op, params: { ...op.params, [field]: suggestion.data.column } }
        dispatch({
          type: 'EDIT_OPERATION',
          index: opIndex,
          operation: { ...updated, summary: generateSummary(updated) },
          label: `Fixed ${op.type.replace(/_/g, ' ')}`,
        })
        toast.success(`Updated to use column "${suggestion.data.column}"`)
      } else if (suggestion.action === 'move-after' && typeof suggestion.data?.afterIndex === 'number') {
        const afterIndex = suggestion.data.afterIndex
        const newOps = [...operations]
        const [removed] = newOps.splice(opIndex, 1)
        const insertAt = afterIndex >= opIndex ? afterIndex : afterIndex + 1
        newOps.splice(insertAt, 0, removed)
        dispatch({ type: 'REORDER_OPERATIONS', operations: newOps, label: 'Moved operation' })
        toast.success('Operation moved')
      }
    },
    [operations]
  )

  const handleAddOperationClick = () => setCategoryDialogOpen(true)

  const handleSelectOperationType = (type: string) => {
    setConfigOperationType(type)
    setConfigInitialParams(undefined)
    setConfigMode('add')
    setConfigDialogOpen(true)
  }

  const handleConfigSave = (op: Operation) => {
    if (configMode === 'edit' && editingIndex !== null) {
      const updatedOp: PipelineOperation = {
        ...op,
        id: operations[editingIndex].id,
        summary: generateSummary(op),
      }
      dispatch({ type: 'EDIT_OPERATION', index: editingIndex, operation: updatedOp, label: `Edited ${op.type.replace(/_/g, ' ')}` })
      setEditingIndex(null)
    } else {
      const newOp: PipelineOperation = {
        ...op,
        id: `op-${Date.now()}-${Math.random()}`,
        summary: generateSummary(op),
      }
      dispatch({ type: 'ADD_OPERATION', operation: newOp, label: `Added ${op.type.replace(/_/g, ' ')}` })
    }
    setValidationResult(null)
    setConfigDialogOpen(false)
    setConfigOperationType(null)
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    const newOps = [...operations]
    ;[newOps[index - 1], newOps[index]] = [newOps[index], newOps[index - 1]]
    dispatch({ type: 'REORDER_OPERATIONS', operations: newOps, label: 'Moved operation up' })
    setValidationResult(null)
  }

  const moveDown = (index: number) => {
    if (index === operations.length - 1) return
    const newOps = [...operations]
    ;[newOps[index], newOps[index + 1]] = [newOps[index + 1], newOps[index]]
    dispatch({ type: 'REORDER_OPERATIONS', operations: newOps, label: 'Moved operation down' })
    setValidationResult(null)
  }

  const deleteOperation = (index: number) => {
    const typeLabel = operations[index].type.replace(/_/g, ' ')
    dispatch({ type: 'DELETE_OPERATION', index, label: `Removed ${typeLabel}` })
    setValidationResult(null)
  }

  const startEdit = (index: number) => {
    const op = operations[index]
    setEditingIndex(index)
    setConfigOperationType(op.type)
    setConfigInitialParams({ ...op.params })
    setConfigMode('edit')
    setConfigDialogOpen(true)
  }

  // Sync present to parent
  useEffect(() => {
    onOperationsChange?.(toApiOperations(operations))
  }, [operations, onOperationsChange])

  // Draft recovery and initial load on mount
  useEffect(() => {
    if (draftChecked.current) return
    draftChecked.current = true
    const draft = getCurrentDraft()
    if (draft?.operations?.length) {
      setDraftRestoreOpen(true)
      return
    }
    if (initialOperations?.length && !initialLoadDone.current) {
      initialLoadDone.current = true
      const pipelineOps = opsToPipelineOps(initialOperations, generateSummary)
      dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
    }
  }, [initialOperations, columns])


  // Auto-save draft (immediate debounce 1s for quick persistence)
  useEffect(() => {
    if (operations.length === 0) return
    const t = setTimeout(() => setCurrentDraft(toApiOperations(operations)), 1000)
    return () => clearTimeout(t)
  }, [operations])

  // Auto-save with 30s delay and toast feedback
  useAutoSave({
    data: toApiOperations(operations),
    onSave: (ops) => {
      const opsArr = ops as import('@/lib/api').Operation[]
      if (opsArr?.length) {
        setCurrentDraft(opsArr)
        toast.success('Pipeline auto-saved', { duration: 1000 })
      }
    },
    delay: 30000,
    enabled: operations.length > 0,
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        if (historyState.past.length > 0) {
          dispatch({ type: 'UNDO' })
          toast.success(`Undone: ${historyState.past[historyState.past.length - 1].label}`)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        e.preventDefault()
        if (historyState.future.length > 0) {
          dispatch({ type: 'REDO' })
          toast.success(`Redone: ${historyState.future[0].label}`)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (operations.length > 0) setSaveDialogOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyState.past.length, historyState.future.length, operations.length])

  const handleLoadPipeline = useCallback((ops: Operation[]) => {
    const pipelineOps = opsToPipelineOps(ops, generateSummary)
    dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
  }, [])

  const handleExportPipeline = useCallback(() => {
    const payload = {
      name: 'Pipeline',
      description: '',
      version: '1.0',
      operations: toApiOperations(operations),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const name = `pipeline-${new Date().toISOString().slice(0, 10)}.json`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Pipeline exported')
  }, [operations])

  const handleImportPipeline = useCallback(() => {
    importFileRef?.click()
  }, [importFileRef])

  const handleImportFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = reader.result as string
          const data = JSON.parse(raw) as { operations?: unknown[] }
          if (!Array.isArray(data?.operations)) {
            toast.error('Invalid pipeline file: missing operations array')
            return
          }
          const valid = data.operations.every(
            (o: unknown) =>
              typeof o === 'object' && o !== null && 'type' in o && 'params' in o
          )
          if (!valid) {
            toast.error('Invalid pipeline file: each operation must have type and params')
            return
          }
          const ops = data.operations as Operation[]
          const pipelineOps = opsToPipelineOps(ops, generateSummary)
          dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
          toast.success('Pipeline imported')
        } catch {
          toast.error('Invalid JSON file')
        }
      }
      reader.readAsText(file)
    },
    [columns]
  )

  const handleClearPipeline = useCallback(() => {
    dispatch({ type: 'CLEAR_PIPELINE' })
    clearCurrentDraft()
    setClearConfirmOpen(false)
    toast.success('Pipeline cleared')
  }, [])

  const handleDraftRestore = useCallback(() => {
    const draft = getCurrentDraft()
    if (draft?.operations?.length) {
      const pipelineOps = opsToPipelineOps(draft.operations, generateSummary)
      dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
      toast.success('Draft restored')
    }
    setDraftRestoreOpen(false)
  }, [])

  const handleDraftDiscard = useCallback(() => {
    clearCurrentDraft()
    setDraftRestoreOpen(false)
    if (initialOperations?.length && !initialLoadDone.current) {
      initialLoadDone.current = true
      const pipelineOps = opsToPipelineOps(initialOperations, generateSummary)
      dispatch({ type: 'LOAD_PIPELINE', operations: pipelineOps })
    }
  }, [initialOperations, columns])

  // Validate pipeline
  const handleValidate = async () => {
    if (operations.length === 0) {
      onError?.('Pipeline is empty. Add at least one operation.')
      return
    }

    setIsValidating(true)
    setValidationResult(null)
    if (onError) onError('')

    try {
      const ops: Operation[] = operations.map(({ summary, ...op }) => {
        // Remove summary from the operation object
        const { id, ...rest } = op
        return rest
      })
      const result = await excelApi.validatePipeline(fileId, sheetName, ops)
      setValidationResult(
        result && typeof result.ok === 'boolean'
          ? { ok: result.ok, errors: Array.isArray(result.errors) ? result.errors : [] }
          : null
      )

      if (result && !result.ok) {
        setTimeout(() => firstErrorCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100)
      }

      if (result && !result.ok && Array.isArray(result.errors) && result.errors.length > 0) {
        const errorMessages = result.errors
          .map(
            (err: { opIndex?: number; opType?: string; message?: string }) =>
              `Operation ${(err.opIndex ?? 0) + 1} (${err.opType ?? 'unknown'}): ${err.message ?? 'Unknown error'}`
          )
          .join('\n')
        onError?.(errorMessages)
      }
    } catch (err: unknown) {
      onError?.(getApiErrorDetail(err))
    } finally {
      setIsValidating(false)
    }
  }

  // Run pipeline
  const handleRun = async () => {
    if (operations.length === 0) {
      onError?.('Pipeline is empty. Add at least one operation.')
      return
    }

    setIsRunning(true)
    setValidationResult(null)
    if (onError) onError('')

    try {
      const ops: Operation[] = operations.map(({ summary, ...op }) => {
        // Remove summary from the operation object
        const { id, ...rest } = op
        return rest
      })
      const response = await excelApi.previewTransform(fileId, sheetName, ops)
      clearCurrentDraft()
      onTransformSuccess(response)
    } catch (err: unknown) {
      onError?.(getApiErrorDetail(err))
    } finally {
      setIsRunning(false)
    }
  }

  const handleConfigOpenChange = (open: boolean) => {
    setConfigDialogOpen(open)
    if (!open) setEditingIndex(null)
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Transformation Pipeline Builder
          </CardTitle>
          <CardDescription>
            Build a pipeline of operations to transform your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.features.showAutoAnalysis && !batchMode && (aiSuggestion || isAiSuggesting) && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-sky-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-sky-900">
                    AI Suggestion
                  </p>
                  <p className="text-sm text-sky-800">
                    {isAiSuggesting ? 'Thinking...' : aiSuggestion}
                  </p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">
                Current Pipeline ({operations.length})
                {(isValidating || isRunning) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {isValidating ? 'Validating…' : 'Running…'}
                  </span>
                )}
              </h3>
              <TooltipProvider>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={historyState.past.length === 0}
                        onClick={() => {
                          if (historyState.past.length > 0) {
                            const label = historyState.past[historyState.past.length - 1].label
                            dispatch({ type: 'UNDO' })
                            toast.success(`Undone: ${label}`)
                          }
                        }}
                        className="text-muted-foreground disabled:opacity-50"
                        aria-label="Undo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {historyState.past.length > 0
                        ? `Undo: ${historyState.past[historyState.past.length - 1].label}`
                        : 'Undo'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={historyState.future.length === 0}
                        onClick={() => {
                          if (historyState.future.length > 0) {
                            const label = historyState.future[0].label
                            dispatch({ type: 'REDO' })
                            toast.success(`Redone: ${label}`)
                          }
                        }}
                        className="text-muted-foreground disabled:opacity-50"
                        aria-label="Redo"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {historyState.future.length > 0
                        ? `Redo: ${historyState.future[0].label}`
                        : 'Redo'}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setHistoryDialogOpen(true)}
                        className="relative text-muted-foreground"
                        aria-label="History"
                      >
                        <History className="h-4 w-4" />
                        {(historyState.past.length + historyState.future.length) > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#217346] text-[10px] text-white">
                            {Math.min(historyState.past.length + historyState.future.length, 99)}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>History</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={operations.length === 0}
                    onClick={() => setSaveDialogOpen(true)}
                    className="text-muted-foreground"
                    aria-label="Save pipeline"
                    title="Save pipeline (Ctrl+S)"
                  >
                    <BookmarkPlus className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Pipeline menu">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-2">
                      <div className="flex flex-col gap-0.5">
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => { setLoadDialogOpen(true) }}>
                          <FolderOpen className="h-4 w-4" />
                          Load pipeline
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={handleExportPipeline}>
                          <Download className="h-4 w-4" />
                          Export as JSON
                        </Button>
                        <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={handleImportPipeline}>
                          <Upload className="h-4 w-4" />
                          Import from JSON
                        </Button>
                        <input
                          ref={setImportFileRef}
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleImportFileChange}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="justify-start gap-2 text-destructive hover:text-destructive"
                          onClick={() => setClearConfirmOpen(true)}
                          disabled={operations.length === 0}
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear pipeline
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </TooltipProvider>
            </div>

              {isRunning ? (
                <TransformProgress
                  totalSteps={operations.length}
                  currentStep={operations.length}
                  currentOperation="Applying transformations..."
                  status="running"
                />
              ) : isValidating ? (
                <SkeletonPipeline cards={3} />
              ) : operations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground border rounded-md">
                  Pipeline is empty. Click Add Operation to get started.
                </div>
              ) : (
                <div className="space-y-3">
                  {operations.map((op, index) => {
                    const vr = validationResults[index]
                    const status = vr?.status ?? 'valid'
                    const message = vr?.message
                    const suggestions = vr?.suggestions ?? []
                    const isFirstError = status === 'error' && validationResults.findIndex((r) => r.status === 'error') === index
                    return (
                      <Card
                        key={op.id}
                        ref={isFirstError ? firstErrorCardRef : null}
                        className={cn(
                          'relative transition-colors',
                          status === 'error' && 'border-red-500 bg-red-50/50 dark:bg-red-950/20',
                          status === 'warning' && 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
                          status === 'valid' && 'border-green-500/50'
                        )}
                      >
                        <CardContent className="p-4">
                          <div className="absolute top-2 right-2">
                            {status === 'valid' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span><CheckCircle2 className="h-5 w-5 text-green-600" aria-label="Valid" /></span>
                                </TooltipTrigger>
                                <TooltipContent>Valid</TooltipContent>
                              </Tooltip>
                            )}
                            {status === 'warning' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span><AlertTriangle className="h-5 w-5 text-amber-600" aria-label="Warning" /></span>
                                </TooltipTrigger>
                                <TooltipContent>{message ?? 'Warning'}</TooltipContent>
                              </Tooltip>
                            )}
                            {status === 'error' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span><XCircle className="h-5 w-5 text-red-600" aria-label="Error" /></span>
                                </TooltipTrigger>
                                <TooltipContent>{message ?? 'Error'}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-start justify-between gap-4 pr-8">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-muted-foreground">
                                  #{index + 1}
                                </span>
                                <span className="text-sm font-semibold capitalize">
                                  {op.type}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{op.summary}</p>
                              {message && (
                                <p
                                  className={cn(
                                    'mt-2 text-xs',
                                    status === 'error' && 'text-red-600',
                                    status === 'warning' && 'text-amber-600'
                                  )}
                                >
                                  {message}
                                </p>
                              )}
                              {suggestions.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {suggestions.map((s, idx) => (
                                    <Button
                                      key={idx}
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => applySuggestion(index, s)}
                                    >
                                      {s.label}
                                    </Button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                title="Move up"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => moveDown(index)}
                                disabled={index === operations.length - 1}
                                title="Move down"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => startEdit(index)}
                                disabled={configDialogOpen}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteOperation(index)}
                                disabled={configDialogOpen}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}

              {/* Validation Result */}
              {validationResult && (
                <motion.div
                  key={validationResult.ok ? 'valid' : `invalid-${JSON.stringify(validationResult.errors)}`}
                  initial={false}
                  animate={{
                    x: validationResult.ok ? 0 : [0, -8, 8, -6, 6, 0],
                  }}
                  transition={
                    validationResult.ok
                      ? undefined
                      : { duration: 0.4 }
                  }
                >
                  <Card className={validationResult.ok ? 'border-green-500' : 'border-red-500'}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {validationResult.ok ? (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            className="flex items-center gap-2"
                          >
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-semibold text-green-500">Pipeline is valid</span>
                          </motion.div>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-500" />
                            <span className="font-semibold text-red-500">Validation errors found</span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {validationResults.filter((r) => r.status === 'valid').length} valid ✓ ·{' '}
                        {validationResults.filter((r) => r.status === 'warning').length} warnings ⚠ ·{' '}
                        {validationResults.filter((r) => r.status === 'error').length} errors ❌
                      </p>
                      {!validationResult.ok &&
                        Array.isArray(validationResult.errors) &&
                        validationResult.errors.length > 0 && (
                          <div className="space-y-1 text-sm">
                            {validationResult.errors.map((err, idx) => (
                              <div key={idx} className="text-red-600">
                                Operation {(err.opIndex ?? idx) + 1} ({err.opType ?? 'unknown'}):{' '}
                                {err.message ?? 'Unknown error'}
                              </div>
                            ))}
                          </div>
                        )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  data-tour="add-operation"
                  onClick={handleAddOperationClick}
                  disabled={configDialogOpen}
                  className="bg-[#217346] hover:bg-[#217346]/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Operation
                </Button>
                <span className="flex items-center gap-1 flex-1">
                  <HelpTooltip
                    title="Validate Pipeline"
                    content="Check for errors before running transformations. Fix any reported issues before running."
                    side="bottom"
                  />
                  <Button
                    data-tour="validate-pipeline"
                    onClick={handleValidate}
                    disabled={isValidating || operations.length === 0 || configDialogOpen}
                    variant="outline"
                    className="flex-1"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Validate Pipeline
                      </>
                    )}
                  </Button>
                </span>
                {!batchMode && (
                  <span className="flex items-center gap-1 flex-1">
                    <HelpTooltip
                      title="Run & Preview"
                      content={hasValidationErrors ? `Fix ${errorCount} error(s) before running pipeline.` : 'Transform data and see results without downloading. Use Export to download the result.'}
                      side="bottom"
                    />
                    <Button
                      onClick={handleRun}
                      disabled={isRunning || operations.length === 0 || configDialogOpen || hasValidationErrors}
                      className="flex-1"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Run & Preview
                        </>
                      )}
                    </Button>
                  </span>
                )}
              </div>
            </div>
        </CardContent>
      </Card>

      <OperationCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSelectOperation={handleSelectOperationType}
      />
      <OperationConfigDialog
        open={configDialogOpen}
        onOpenChange={handleConfigOpenChange}
        operationType={configOperationType}
        initialParams={configInitialParams}
        columns={columns}
        availableColumns={
          configMode === 'edit' && editingIndex !== null
            ? getAvailableColumnsAtStep(operations, editingIndex - 1, columns)
            : columns
        }
        mode={configMode}
        onSave={handleConfigSave}
      />
      <SavePipelineDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        operations={toApiOperations(operations)}
        onSaved={clearCurrentDraft}
      />
      <LoadPipelineDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
        onLoad={handleLoadPipeline}
        hasCurrentChanges={operations.length > 0}
        currentCount={operations.length}
      />
      <HistoryTimeline
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
        state={historyState}
        onRestore={(index) => dispatch({ type: 'RESTORE_TO', index })}
      />
      <AlertDialog open={draftRestoreOpen} onOpenChange={setDraftRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore unsaved work?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved work from a previous session. Restore it or discard and start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={handleDraftDiscard}>Discard</Button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-[#217346] hover:bg-[#1a5a38]" onClick={handleDraftRestore}>
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {operations.length} operation{operations.length !== 1 ? 's' : ''}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClearPipeline}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

