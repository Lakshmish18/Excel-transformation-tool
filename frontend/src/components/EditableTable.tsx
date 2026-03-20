/**
 * Editable table component: double-click cells to edit, save changes.
 * Used in Preview and Results pages for manual data corrections.
 */
import { useState, useRef, useEffect } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Save, X, Edit2, RotateCcw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EditableTableProps {
  columns: string[]
  rows: Record<string, unknown>[]
  onSave?: (updatedRows: Record<string, unknown>[]) => void
  /** Enable editing mode (default: true) */
  editable?: boolean
  /** Show save button (default: true) */
  showSaveButton?: boolean
  /** Maximum height for scrollable table */
  maxHeight?: string
}

export function EditableTable({
  columns,
  rows: initialRows,
  onSave,
  editable = true,
  showSaveButton = true,
  maxHeight = '600px',
}: EditableTableProps) {
  const [data, setData] = useState<Record<string, unknown>[]>(initialRows)
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync with external data changes
  useEffect(() => {
    setData(initialRows)
    setHasChanges(false)
  }, [initialRows])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  const startEdit = (rowIndex: number, colName: string) => {
    if (!editable) return
    setEditingCell({ row: rowIndex, col: colName })
    setEditValue(String(data[rowIndex]?.[colName] ?? ''))
  }

  const saveEdit = () => {
    if (!editingCell) return

    const newData = [...data]
    if (!newData[editingCell.row]) {
      newData[editingCell.row] = {}
    }
    
    // Preserve original value type if possible
    const originalValue = data[editingCell.row]?.[editingCell.col]
    let newValue: unknown = editValue
    
    // Try to preserve type
    if (typeof originalValue === 'number' && !isNaN(Number(editValue))) {
      newValue = Number(editValue)
    } else if (originalValue === null || originalValue === undefined) {
      newValue = editValue || null
    }

    newData[editingCell.row][editingCell.col] = newValue
    setData(newData)
    setEditingCell(null)
    setHasChanges(true)
    toast.success('Cell updated')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      if (!editingCell) return
      
      // Move to next cell
      const currentColIndex = columns.indexOf(editingCell.col)
      const nextColIndex = e.shiftKey ? currentColIndex - 1 : currentColIndex + 1
      
      if (nextColIndex >= 0 && nextColIndex < columns.length) {
        saveEdit()
        setTimeout(() => {
          startEdit(editingCell.row, columns[nextColIndex])
        }, 50)
      } else {
        // Move to next/previous row
        const nextRow = e.shiftKey ? editingCell.row - 1 : editingCell.row + 1
        if (nextRow >= 0 && nextRow < data.length) {
          saveEdit()
          setTimeout(() => {
            startEdit(nextRow, columns[e.shiftKey ? columns.length - 1 : 0])
          }, 50)
        } else {
          saveEdit()
        }
      }
    }
  }

  const saveAll = () => {
    if (onSave) {
      onSave(data)
      setHasChanges(false)
      toast.success('All changes saved')
    } else {
      toast.info('No save handler provided')
    }
  }

  const resetChanges = () => {
    setData(initialRows)
    setHasChanges(false)
    setEditingCell(null)
    toast.success('Changes reset')
  }

  const exportEditedData = () => {
    try {
      // Convert data to CSV
      const headers = columns.join(',')
      const rows = data.map((row) =>
        columns.map((col) => {
          const value = row[col] ?? ''
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return String(value)
        }).join(',')
      )
      const csv = [headers, ...rows].join('\n')
      
      // Download as CSV
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited_data_${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Edited data exported as CSV')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export data')
    }
  }

  return (
    <div className="space-y-4">
      {editable && showSaveButton && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            <Button onClick={saveAll} disabled={!hasChanges || !onSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
            {hasChanges && (
              <Button onClick={resetChanges} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            )}
            <Button onClick={exportEditedData} variant="outline" size="sm" title="Export edited data as CSV">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          {hasChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400">
              • Unsaved changes
            </span>
          )}
        </div>
      )}

      <div className="border rounded-md overflow-auto" style={{ maxHeight }}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col} className="font-semibold sticky top-0 bg-muted z-10">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex} className="hover:bg-muted/50">
                  {columns.map((col) => {
                    const isEditing =
                      editingCell?.row === rowIndex && editingCell?.col === col
                    const cellValue = row[col] ?? ''

                    return (
                      <TableCell
                        key={col}
                        className={cn(
                          'relative group',
                          editable && 'cursor-pointer',
                          isEditing && 'bg-primary/5'
                        )}
                        onDoubleClick={() => editable && startEdit(rowIndex, col)}
                        title={editable ? 'Double-click to edit' : undefined}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              ref={inputRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              onBlur={saveEdit}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={saveEdit}
                              title="Save (Enter)"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEdit}
                              title="Cancel (Esc)"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between min-h-[2rem]">
                            <span className="flex-1">{String(cellValue)}</span>
                            {editable && (
                              <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-2 shrink-0" />
                            )}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editable && (
        <p className="text-xs text-muted-foreground">
          💡 Double-click any cell to edit. Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> to save,{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> to cancel,{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd> to move to next cell.
        </p>
      )}
    </div>
  )
}
