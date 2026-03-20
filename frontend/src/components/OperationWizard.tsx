import { useState, useEffect } from 'react'
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
import { CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { excelApi, getApiErrorDetail, type Operation } from '@/lib/api'
import { useDebounce } from '@/hooks/useDebounce'

interface OperationWizardProps {
  fileId: string
  sheetName: string
  columns: string[]
  operationType: string
  onApply: (operation: Operation) => void
  onCancel: () => void
}

interface ValidationError {
  field?: string
  message: string
  suggestions?: string[]
}

export function OperationWizard({
  fileId,
  sheetName,
  columns,
  operationType,
  onApply,
  onCancel,
}: OperationWizardProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Form fields vary by operation type
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [validationError, setValidationError] = useState<ValidationError | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Debounce form data for validation
  const debouncedFormData = useDebounce(formData, 500)

  // Auto-validate when form data changes
  useEffect(() => {
    if (operationType && Object.keys(debouncedFormData).length > 0) {
      validateOperation()
    }
  }, [debouncedFormData, operationType])

  const validateOperation = async () => {
    if (!operationType) return

    const operation = buildOperation()
    if (!operation) {
      setIsValid(false)
      return
    }

    setIsValidating(true)
    setValidationError(null)
    setFieldErrors({})

    try {
      const result = await excelApi.validatePipeline(fileId, sheetName, [operation])
      
      if (result.ok) {
        setIsValid(true)
        setValidationError(null)
        setFieldErrors({})
      } else {
        setIsValid(false)
        if (result.errors.length > 0) {
          const error = result.errors[0]
          const suggestions = extractSuggestions(error.message)
          setValidationError({
            field: error.opType,
            message: error.message,
            suggestions,
          })
          
          // Try to identify which field has the error
          const fieldError = identifyField(error.message, operationType)
          if (fieldError) {
            setFieldErrors({ [fieldError.field]: fieldError.message })
          }
        }
      }
    } catch (err: unknown) {
      setIsValid(false)
      const errorDetail = getApiErrorDetail(err)
      setValidationError({
        message: errorDetail,
        suggestions: extractSuggestions(errorDetail),
      })
    } finally {
      setIsValidating(false)
    }
  }

  const extractSuggestions = (message: string): string[] => {
    const suggestions: string[] = []
    
    // Extract "Did you mean" suggestions
    const didYouMeanMatch = message.match(/Did you mean:?\s*([^?]+)/i)
    if (didYouMeanMatch) {
      const suggestionsList = didYouMeanMatch[1].split(',').map(s => s.trim())
      suggestions.push(...suggestionsList)
    }
    
    // Extract available columns
    const availableColsMatch = message.match(/Available columns:?\s*([^.]+)/i)
    if (availableColsMatch) {
      const cols = availableColsMatch[1].split(',').map(s => s.trim())
      suggestions.push(...cols.slice(0, 5)) // Limit to 5
    }
    
    // Add context-specific suggestions
    if (message.includes('must be numeric')) {
      suggestions.push('Use "Convert to Number" operation first')
    }
    if (message.includes('not found')) {
      suggestions.push('Check column name spelling')
      suggestions.push('Select from available columns below')
    }
    
    return [...new Set(suggestions)] // Remove duplicates
  }

  const identifyField = (message: string, opType: string): { field: string; message: string } | null => {
    // Try to identify which field has the error based on message content
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('column') && !lowerMessage.includes('columns')) {
      // Single column error
      if (opType === 'filter' || opType === 'replace' || opType === 'text_cleanup') {
        return { field: 'column', message }
      }
      if (opType === 'math') {
        if (lowerMessage.includes('cola') || lowerMessage.includes('first column')) {
          return { field: 'colA', message }
        }
        return { field: 'colBOrValue', message }
      }
    }
    
    if (lowerMessage.includes('newcolumn') || lowerMessage.includes('new column')) {
      return { field: 'newColumn', message }
    }
    
    if (lowerMessage.includes('revenue') || lowerMessage.includes('costofgoodssold')) {
      if (opType === 'gross_profit') {
        if (lowerMessage.includes('revenue')) return { field: 'revenueColumn', message }
        return { field: 'costOfGoodsSoldColumn', message }
      }
    }
    
    return null
  }

  const buildOperation = (): Operation | null => {
    if (!operationType) return null

    const baseOp: Operation = {
      type: operationType as Operation['type'],
      params: {},
    }

    switch (operationType) {
      case 'filter':
        if (!formData.column || !formData.operator || formData.value === undefined) return null
        baseOp.params = {
          column: formData.column,
          operator: formData.operator,
          value: formData.value,
        }
        break

      case 'replace':
        if (!formData.column || formData.oldValue === undefined || formData.newValue === undefined) return null
        baseOp.params = {
          column: formData.column,
          oldValue: formData.oldValue,
          newValue: formData.newValue,
        }
        break

      case 'math':
        if (!formData.colA || !formData.operation || !formData.newColumn) return null
        baseOp.params = {
          operation: formData.operation,
          colA: formData.colA,
          colBOrValue: formData.colBOrValue || formData.colBValue,
          newColumn: formData.newColumn,
        }
        break

      case 'sort':
        if (!formData.columns || formData.columns.length === 0) return null
        baseOp.params = {
          columns: formData.columns,
        }
        break

      case 'select_columns':
        if (!formData.columns || formData.columns.length === 0) return null
        baseOp.params = {
          columns: formData.columns,
        }
        break

      case 'remove_duplicates':
        baseOp.params = {
          subset: formData.subset || undefined,
        }
        break

      case 'aggregate':
        if (!formData.aggregations) return null
        baseOp.params = {
          aggregations: formData.aggregations,
          groupBy: formData.groupBy || [],
        }
        break

      case 'text_cleanup':
        if (!formData.column || !formData.operations) return null
        baseOp.params = {
          column: formData.column,
          operations: formData.operations,
        }
        break

      case 'split_column':
        if (!formData.column || !formData.separator || !formData.newColumns) return null
        baseOp.params = {
          column: formData.column,
          separator: formData.separator,
          newColumns: formData.newColumns,
        }
        break

      case 'merge_columns':
        if (!formData.columns || formData.columns.length < 2 || !formData.newColumn) return null
        baseOp.params = {
          columns: formData.columns,
          newColumn: formData.newColumn,
          separator: formData.separator || ' ',
        }
        break

      case 'date_format':
        if (!formData.column || !formData.outputFormat) return null
        baseOp.params = {
          column: formData.column,
          outputFormat: formData.outputFormat,
        }
        break

      case 'remove_blank_rows':
        baseOp.params = {
          columns: formData.columns || undefined,
        }
        break

      case 'convert_to_numeric':
        if (!formData.column) return null
        baseOp.params = {
          column: formData.column,
          errors: formData.errors || 'coerce',
        }
        break

      case 'gross_profit':
        if (!formData.revenueColumn || !formData.costOfGoodsSoldColumn || !formData.newColumn) return null
        baseOp.params = {
          revenueColumn: formData.revenueColumn,
          costOfGoodsSoldColumn: formData.costOfGoodsSoldColumn,
          newColumn: formData.newColumn,
        }
        break

      case 'net_profit':
        if (!formData.grossProfitColumn || !formData.expensesColumn || !formData.newColumn) return null
        baseOp.params = {
          grossProfitColumn: formData.grossProfitColumn,
          expensesColumn: formData.expensesColumn,
          newColumn: formData.newColumn,
        }
        break

      case 'profit_loss':
        if (!formData.dateColumn || !formData.revenueColumn || !formData.costColumn || !formData.period) return null
        baseOp.params = {
          dateColumn: formData.dateColumn,
          revenueColumn: formData.revenueColumn,
          costColumn: formData.costColumn,
          period: formData.period,
          newColumns: formData.newColumns || {},
        }
        break

      default:
        return null
    }

    return baseOp
  }

  const handleApply = () => {
    const operation = buildOperation()
    if (operation && isValid) {
      onApply(operation)
      // Reset form
      setFormData({})
      setValidationError(null)
      setIsValid(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    // Auto-fill the suggestion if it's a column name
    if (columns.includes(suggestion)) {
      // Find which field should be filled based on current operation
      if (operationType === 'filter' || operationType === 'replace' || operationType === 'text_cleanup') {
        setFormData(prev => ({ ...prev, column: suggestion }))
      } else if (operationType === 'math') {
        if (!formData.colA) {
          setFormData(prev => ({ ...prev, colA: suggestion }))
        } else {
          setFormData(prev => ({ ...prev, colBOrValue: suggestion }))
        }
      }
    }
  }

  const renderForm = () => {
    switch (operationType) {
      case 'filter':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="column">Column *</Label>
              <Select
                value={formData.column || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, column: value }))}
              >
                <SelectTrigger id="column" className={fieldErrors.column ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.column && (
                <p className="text-xs text-red-600 mt-1">{fieldErrors.column}</p>
              )}
            </div>
            <div>
              <Label htmlFor="operator">Condition *</Label>
              <Select
                value={formData.operator || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, operator: value }))}
              >
                <SelectTrigger id="operator">
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals (=)</SelectItem>
                  <SelectItem value="not_equals">Not Equals (≠)</SelectItem>
                  <SelectItem value="greater_than">Greater Than (&gt;)</SelectItem>
                  <SelectItem value="less_than">Less Than (&lt;)</SelectItem>
                  <SelectItem value="greater_equal">Greater or Equal (≥)</SelectItem>
                  <SelectItem value="less_equal">Less or Equal (≤)</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="not_contains">Not Contains</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="value">Value *</Label>
              <Input
                id="value"
                value={formData.value || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Enter value"
              />
            </div>
          </div>
        )

      case 'replace':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="column">Column *</Label>
              <Select
                value={formData.column || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, column: value }))}
              >
                <SelectTrigger id="column">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="oldValue">Find *</Label>
              <Input
                id="oldValue"
                value={formData.oldValue || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, oldValue: e.target.value }))}
                placeholder="Value to find"
              />
            </div>
            <div>
              <Label htmlFor="newValue">Replace With *</Label>
              <Input
                id="newValue"
                value={formData.newValue || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, newValue: e.target.value }))}
                placeholder="New value"
              />
            </div>
          </div>
        )

      case 'math':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="colA">First Column *</Label>
              <Select
                value={formData.colA || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, colA: value }))}
              >
                <SelectTrigger id="colA">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="operation">Operation *</Label>
              <Select
                value={formData.operation || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, operation: value }))}
              >
                <SelectTrigger id="operation">
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add (+)</SelectItem>
                  <SelectItem value="subtract">Subtract (-)</SelectItem>
                  <SelectItem value="multiply">Multiply (×)</SelectItem>
                  <SelectItem value="divide">Divide (÷)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="colBOrValue">Second Column or Value *</Label>
              <Input
                id="colBOrValue"
                value={formData.colBOrValue || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, colBOrValue: e.target.value }))}
                placeholder="Column name or number"
              />
            </div>
            <div>
              <Label htmlFor="newColumn">New Column Name *</Label>
              <Input
                id="newColumn"
                value={formData.newColumn || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, newColumn: e.target.value }))}
                placeholder="e.g., Total, Result"
              />
            </div>
          </div>
        )

      case 'gross_profit':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="revenueColumn">Revenue Column *</Label>
              <Select
                value={formData.revenueColumn || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, revenueColumn: value }))}
              >
                <SelectTrigger id="revenueColumn">
                  <SelectValue placeholder="Select revenue column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="costOfGoodsSoldColumn">Cost of Goods Sold Column *</Label>
              <Select
                value={formData.costOfGoodsSoldColumn || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, costOfGoodsSoldColumn: value }))}
              >
                <SelectTrigger id="costOfGoodsSoldColumn">
                  <SelectValue placeholder="Select COGS column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="newColumn">New Column Name *</Label>
              <Input
                id="newColumn"
                value={formData.newColumn || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, newColumn: e.target.value }))}
                placeholder="e.g., Gross Profit"
              />
            </div>
          </div>
        )

      case 'text_cleanup':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="column">Column *</Label>
              <Select
                value={formData.column || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, column: value }))}
              >
                <SelectTrigger id="column">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operations *</Label>
              <div className="space-y-2">
                {['trim', 'lowercase', 'uppercase', 'remove_symbols'].map((op) => (
                  <label key={op} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(formData.operations || []).includes(op)}
                      onChange={(e) => {
                        const ops = formData.operations || []
                        if (e.target.checked) {
                          setFormData(prev => ({ ...prev, operations: [...ops, op] }))
                        } else {
                          setFormData(prev => ({ ...prev, operations: ops.filter((o: string) => o !== op) }))
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm capitalize">{op.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 'convert_to_numeric':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="column">Column *</Label>
              <Select
                value={formData.column || ''}
                onValueChange={(value) => setFormData(prev => ({ ...prev, column: value }))}
              >
                <SelectTrigger id="column">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'remove_duplicates':
        return (
          <div className="space-y-4">
            <div>
              <Label>Columns to Check (optional)</Label>
              <p className="text-xs text-gray-500 mb-2">Leave empty to check all columns</p>
              <Select
                value=""
                onValueChange={(value) => {
                  const subset = formData.subset || []
                  if (!subset.includes(value)) {
                    setFormData(prev => ({ ...prev, subset: [...subset, value] }))
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select columns (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.subset && formData.subset.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.subset.map((col: string) => (
                    <span
                      key={col}
                      className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs flex items-center gap-1"
                    >
                      {col}
                      <button
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            subset: (prev.subset || []).filter((c: string) => c !== col),
                          }))
                        }}
                        className="ml-1 hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8 text-gray-500 text-sm">
            Form for {operationType.replace('_', ' ')} coming soon...
            <p className="text-xs mt-2">This operation will be available in the next update</p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {operationType ? `${operationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}` : 'Add Transformation'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {renderForm()}

      {/* Validation Status */}
      <div className="pt-4 border-t">
        {isValidating && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Validating...
          </div>
        )}

        {!isValidating && isValid && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Ready to apply
          </div>
        )}

        {!isValidating && validationError && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium">{validationError.message}</p>
                {validationError.suggestions && validationError.suggestions.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium text-gray-700">💡 Suggestions:</p>
                    <div className="flex flex-wrap gap-2">
                      {validationError.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="flex gap-2 pt-2">
        <Button
          onClick={handleApply}
          disabled={!isValid || isValidating}
          className="flex-1 bg-[#217346] hover:bg-[#1a5a38] text-white"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Apply Transformation
        </Button>
      </div>
    </div>
  )
}

