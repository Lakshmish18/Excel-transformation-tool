import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Zap } from 'lucide-react'
import { excelApi, getApiErrorDetail, type TransformResponse } from '@/lib/api'

interface OperationsSectionProps {
  fileId: string
  sheetName: string
  columns: string[]
  onTransformSuccess: (data: TransformResponse) => void
  onError?: (error: string) => void
}

export function OperationsSection({
  fileId,
  sheetName,
  columns,
  onTransformSuccess,
  onError,
}: OperationsSectionProps) {
  const [operationType, setOperationType] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  // Filter operation params
  const [filterColumn, setFilterColumn] = useState<string>('')
  const [filterOperator, setFilterOperator] = useState<string>('')
  const [filterValue, setFilterValue] = useState<string>('')

  // Replace operation params
  const [replaceColumn, setReplaceColumn] = useState<string>('')
  const [oldValue, setOldValue] = useState<string>('')
  const [newValue, setNewValue] = useState<string>('')

  // Math operation params
  const [mathOperation, setMathOperation] = useState<string>('')
  const [colA, setColA] = useState<string>('')
  const [colBOrValue, setColBOrValue] = useState<string>('')
  const [newColumn, setNewColumn] = useState<string>('')

  const handleApply = async () => {
    if (!operationType) {
      if (onError) {
        onError('Please select an operation type')
      }
      return
    }

    setIsLoading(true)
    // Clear error by passing empty string (will be filtered out in parent)
    if (onError) {
      onError('')
    }

    try {
      // Build operation based on type
      const operation: import('@/lib/api').Operation = { type: operationType as import('@/lib/api').Operation['type'], params: {} }

      if (operationType === 'filter') {
        if (!filterColumn || !filterOperator || filterValue === '') {
          onError?.('Please fill all filter parameters')
          setIsLoading(false)
          return
        }
        operation.params = {
          column: filterColumn,
          operator: filterOperator,
          value: isNaN(Number(filterValue)) ? filterValue : Number(filterValue),
        }
      } else if (operationType === 'replace') {
        if (!replaceColumn || oldValue === '' || newValue === '') {
          if (onError) {
            onError('Please fill all replace parameters')
          }
          setIsLoading(false)
          return
        }
        operation.params = {
          column: replaceColumn,
          oldValue: oldValue,
          newValue: newValue,
        }
      } else if (operationType === 'math') {
        if (!mathOperation || !colA || colBOrValue === '' || !newColumn) {
          if (onError) {
            onError('Please fill all math parameters')
          }
          setIsLoading(false)
          return
        }
        // Check if colBOrValue is a number or column name
        const isNumeric = !isNaN(Number(colBOrValue))
        operation.params = {
          operation: mathOperation,
          colA: colA,
          colBOrValue: isNumeric ? Number(colBOrValue) : colBOrValue,
          newColumn: newColumn,
        }
      }

      // Call transform API
      const response = await excelApi.previewTransform(fileId, sheetName, [operation])
      onTransformSuccess(response)
    } catch (err: unknown) {
      onError?.(getApiErrorDetail(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Apply Transformation
        </CardTitle>
        <CardDescription>
          Select an operation type and fill in the parameters, then click Apply & Preview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Operation Type Selection */}
        <div>
          <Label htmlFor="operation-type" className="mb-2 block">
            Operation Type
          </Label>
          <Select value={operationType} onValueChange={setOperationType}>
            <SelectTrigger id="operation-type">
              <SelectValue placeholder="Select operation type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="filter">Filter</SelectItem>
              <SelectItem value="replace">Replace</SelectItem>
              <SelectItem value="math">Math</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Operation Form */}
        {operationType === 'filter' && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <div>
              <Label htmlFor="filter-column">Column</Label>
              <Select value={filterColumn} onValueChange={setFilterColumn}>
                <SelectTrigger id="filter-column">
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
              <Label htmlFor="filter-operator">Operator</Label>
              <Select value={filterOperator} onValueChange={setFilterOperator}>
                <SelectTrigger id="filter-operator">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                  <SelectItem value="greater_equal">Greater or Equal</SelectItem>
                  <SelectItem value="less_equal">Less or Equal</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="not_contains">Not Contains</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-value">Value</Label>
              <Input
                id="filter-value"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                placeholder="Enter value"
              />
            </div>
          </div>
        )}

        {/* Replace Operation Form */}
        {operationType === 'replace' && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <div>
              <Label htmlFor="replace-column">Column</Label>
              <Select value={replaceColumn} onValueChange={setReplaceColumn}>
                <SelectTrigger id="replace-column">
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
              <Label htmlFor="old-value">Old Value</Label>
              <Input
                id="old-value"
                value={oldValue}
                onChange={(e) => setOldValue(e.target.value)}
                placeholder="Value to find"
              />
            </div>
            <div>
              <Label htmlFor="new-value">New Value</Label>
              <Input
                id="new-value"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value to replace with"
              />
            </div>
          </div>
        )}

        {/* Math Operation Form */}
        {operationType === 'math' && (
          <div className="space-y-4 p-4 border rounded-md bg-muted/50">
            <div>
              <Label htmlFor="math-operation">Operation</Label>
              <Select value={mathOperation} onValueChange={setMathOperation}>
                <SelectTrigger id="math-operation">
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
              <Label htmlFor="col-a">Column A</Label>
              <Select value={colA} onValueChange={setColA}>
                <SelectTrigger id="col-a">
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
              <Label htmlFor="col-b-or-value">
                Column B or Value (enter number or column name)
              </Label>
              <Input
                id="col-b-or-value"
                value={colBOrValue}
                onChange={(e) => setColBOrValue(e.target.value)}
                placeholder="Column name or number"
              />
            </div>
            <div>
              <Label htmlFor="new-column">New Column Name</Label>
              <Input
                id="new-column"
                value={newColumn}
                onChange={(e) => setNewColumn(e.target.value)}
                placeholder="Name for calculated column"
              />
            </div>
          </div>
        )}

        {/* Apply Button */}
        <Button
          onClick={handleApply}
          disabled={isLoading || !operationType}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Apply & Preview
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

