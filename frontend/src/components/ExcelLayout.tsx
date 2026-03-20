import { useState } from 'react'
import { useViewState } from '@/hooks/useViewState'
import { OperationsPanel } from './OperationsPanel'
import { ConfigurationDrawer } from './ConfigurationDrawer'
import { AppliedOperationsList } from './AppliedOperationsList'
import { ChangesPanel } from './ChangesPanel'
import { Button } from './ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Loader2, Eye, FileSpreadsheet, Download, Play } from 'lucide-react'
import { excelApi, getApiErrorDetail, type PreviewResponse, type TransformResponse, type Operation, type CellChange } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ExcelLayoutProps {
  fileId: string
  fileName: string
  sheets: string[]
}

export function ExcelLayout({ fileId, fileName, sheets }: ExcelLayoutProps) {
  const [selectedSheet, setSelectedSheet] = useState<string>(sheets[0] || '')
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)
  const [transformData, setTransformData] = useState<TransformResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [operations, setOperations] = useState<Operation[]>([])

  const {
    viewState,
    enterConfigurationMode,
    exitConfigurationMode,
    enterReviewMode,
    exitReviewMode,
  } = useViewState()

  const handlePreview = async () => {
    if (!selectedSheet) return

    setIsLoading(true)
    setError(null)
    setPreviewData(null)
    setTransformData(null)

    try {
      const response = await excelApi.previewSheet(fileId, selectedSheet, 30)
      setPreviewData(response)
    } catch (err: unknown) {
      setError(getApiErrorDetail(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleOperationSelect = (operationType: string) => {
    enterConfigurationMode(operationType || '')
    setError(null)
  }

  const handleOperationTypeSelect = (operationType: string) => {
    enterConfigurationMode(operationType)
  }

  const handleOperationEdit = (index: number) => {
    const operation = operations[index]
    enterConfigurationMode(operation.type, index)
    setError(null)
  }

  const handleOperationApply = (operation: Operation) => {
    if (viewState.editingOperationIndex !== null) {
      // Edit existing operation
      const newOps = [...operations]
      newOps[viewState.editingOperationIndex] = operation
      setOperations(newOps)
    } else {
      // Add new operation
      setOperations([...operations, operation])
    }
    exitConfigurationMode()
    setError(null)
  }

  const handleOperationCancel = () => {
    exitConfigurationMode()
  }

  const handleOperationRemove = (index: number) => {
    setOperations(prev => prev.filter((_, i) => i !== index))
  }

  const handleOperationReorder = (fromIndex: number, toIndex: number) => {
    setOperations(prev => {
      const newOps = [...prev]
      const [moved] = newOps.splice(fromIndex, 1)
      newOps.splice(toIndex, 0, moved)
      return newOps
    })
  }

  const handleRunTransformations = async () => {
    if (operations.length === 0) {
      setError('Please add at least one transformation')
      return
    }

    setIsRunning(true)
    setError(null)

    try {
      const response = await excelApi.previewTransform(fileId, selectedSheet, operations)
      setTransformData(response)
      setPreviewData({
        fileId: response.fileId,
        sheetName: response.sheetName,
        columns: response.columns,
        rows: response.rows,
      })
      enterReviewMode()
    } catch (err: unknown) {
      setError(getApiErrorDetail(err))
    } finally {
      setIsRunning(false)
    }
  }

  const handleDownload = async () => {
    if (!previewData || operations.length === 0) {
      setError('Please add and run transformations first')
      return
    }
    
    try {
      const blob = await excelApi.exportTransform(
        fileId,
        selectedSheet,
        operations,
      )
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transformed_${fileName}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: unknown) {
      setError(getApiErrorDetail(err))
    }
  }

  const isConfiguring = viewState.mode === 'configuring'
  const isReviewing = viewState.mode === 'reviewing'

  return (
    <div className="flex h-full overflow-hidden bg-white relative" style={{ height: '100%' }}>
      {/* Operations Panel - Collapsible */}
      <div
        className={cn(
          'border-r border-gray-300 flex-shrink-0 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isConfiguring ? 'w-12' : 'w-72'
        )}
      >
        <OperationsPanel
          collapsed={isConfiguring}
          onSelectOperation={handleOperationSelect}
          selectedOperation={viewState.selectedOperationType || undefined}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toolbar */}
        <div
          className={cn(
            'bg-[#F2F2F2] border-b border-gray-300 px-4 py-2 flex items-center justify-between transition-opacity duration-200',
            isConfiguring ? 'opacity-40 pointer-events-none' : 'opacity-100'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-[#217346]" />
              <span className="text-sm font-medium text-gray-700">{fileName}</span>
            </div>
            <div className="h-4 w-px bg-gray-400" />
            <Select value={selectedSheet} onValueChange={setSelectedSheet} disabled={isConfiguring}>
              <SelectTrigger className="h-7 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sheets.map((sheet) => (
                  <SelectItem key={sheet} value={sheet}>
                    {sheet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handlePreview}
              disabled={isLoading || !selectedSheet || isConfiguring}
              size="sm"
              className="h-7 bg-[#217346] hover:bg-[#1a5a38] text-white"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Preview
                </>
              )}
            </Button>
          </div>
          {transformData && !isConfiguring && (
            <Button
              onClick={handleDownload}
              size="sm"
              className="h-7 bg-[#217346] hover:bg-[#1a5a38] text-white"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div
            className={cn(
              'bg-red-50 border-b border-red-200 px-4 py-2 transition-opacity duration-200',
              isConfiguring ? 'opacity-40' : 'opacity-100'
            )}
          >
            <div className="text-red-700 text-xs font-medium">{error}</div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left: Applied Operations List */}
          <div
            className={cn(
              'border-r border-gray-300 bg-white transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] flex flex-col overflow-hidden',
              isConfiguring ? 'w-0 border-r-0 opacity-0' : 'w-80 opacity-100'
            )}
          >
            {!isConfiguring && (
              <div className="flex-1 overflow-y-auto p-4">
                {!previewData ? (
                  <div className="text-center py-12 text-gray-500 text-sm">
                    Click Preview to load data and start applying transformations
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AppliedOperationsList
                      operations={operations}
                      onRemove={handleOperationRemove}
                      onReorder={handleOperationReorder}
                      onEdit={handleOperationEdit}
                      onAddNew={() => handleOperationSelect('')}
                      columns={previewData.columns}
                      minimized={false}
                    />
                    
                    {operations.length > 0 && (
                      <div className="pt-4 border-t">
                        <Button
                          onClick={handleRunTransformations}
                          disabled={isRunning}
                          className="w-full bg-[#217346] hover:bg-[#1a5a38] text-white"
                        >
                          {isRunning ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Apply All Transformations
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center: Data Preview - Full width, dims when drawer is open */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div
              className={cn(
                'bg-white border border-gray-300 rounded m-4 flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-out',
                isConfiguring ? 'opacity-40' : 'opacity-100'
              )}
            >
              <div className="bg-[#F2F2F2] border-b border-gray-300 px-4 py-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Data Preview</h3>
                {previewData && (
                  <span className="text-xs text-gray-600">
                    {previewData.rows.length} rows × {previewData.columns.length} columns
                  </span>
                )}
              </div>
              <div
                className={cn(
                  'p-4 overflow-auto flex-1 transition-opacity duration-200',
                  isConfiguring ? 'pointer-events-none' : ''
                )}
                style={{ maxHeight: 'calc(100vh - 300px)' }}
              >
                {previewData ? (
                  <div className="border border-gray-300 rounded overflow-hidden">
                    <table className="w-full border-collapse text-xs">
                      <thead className="bg-[#F2F2F2] sticky top-0 z-10">
                        <tr>
                          {previewData.columns.map((col) => (
                            <th
                              key={col}
                              className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 bg-white"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.length > 0 ? (
                          previewData.rows.map((row, idx) => {
                            const rowChanges: CellChange[] = []
                            if (transformData?.changes) {
                              transformData.changes.forEach(opChange => {
                                opChange.cellsChanged.forEach(cell => {
                                  if (cell.rowIndex === idx) {
                                    rowChanges.push(cell)
                                  }
                                })
                              })
                            }
                            
                            return (
                              <tr key={idx} className={rowChanges.length > 0 ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-blue-50'}>
                                {previewData.columns.map((col) => {
                                  const cellChange = rowChanges.find(c => c.column === col)
                                  return (
                                    <td
                                      key={col}
                                      className={`border border-gray-300 px-3 py-2 text-gray-900 ${
                                        cellChange ? 'bg-green-100 font-medium' : ''
                                      }`}
                                      title={cellChange ? `Changed from "${cellChange.oldValue}" to "${cellChange.newValue}"` : ''}
                                    >
                                      {String(row[col] ?? '')}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={previewData.columns.length}
                              className="text-center py-8 text-gray-500"
                            >
                              No data available
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    No preview data. Click Preview to load.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Configuration Drawer - Slides in from right (fixed positioning) */}
          {viewState.drawerOpen && (
            <ConfigurationDrawer
              isOpen={viewState.drawerOpen}
              operationType={viewState.selectedOperationType}
              editingIndex={viewState.editingOperationIndex}
              fileId={fileId}
              sheetName={selectedSheet}
              columns={previewData?.columns || []}
              onApply={handleOperationApply}
              onCancel={handleOperationCancel}
              onOperationTypeSelect={handleOperationTypeSelect}
            />
          )}

          {/* Changes Panel - Slides in from right (fixed positioning) */}
          {isReviewing && transformData?.changes && viewState.changesPanelOpen && (
            <ChangesPanel
              changes={transformData.changes}
              onClose={exitReviewMode}
              isOpen={viewState.changesPanelOpen}
            />
          )}
        </div>
      </div>
    </div>
  )
}
