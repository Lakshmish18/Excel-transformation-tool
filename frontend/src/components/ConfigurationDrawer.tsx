import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { OperationWizard } from './OperationWizard'
import { cn } from '@/lib/utils'

interface ConfigurationDrawerProps {
  isOpen: boolean
  operationType: string | null
  editingIndex: number | null
  fileId: string
  sheetName: string
  columns: string[]
  onApply: (operation: import('@/lib/api').Operation) => void
  onCancel: () => void
  onOperationTypeSelect?: (operationType: string) => void
}

export function ConfigurationDrawer({
  isOpen,
  operationType,
  editingIndex,
  fileId,
  sheetName,
  columns,
  onApply,
  onCancel,
  onOperationTypeSelect,
}: ConfigurationDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const [selectedOpType, setSelectedOpType] = useState<string | null>(operationType)

  // Sync selectedOpType with operationType prop
  useEffect(() => {
    if (operationType) {
      setSelectedOpType(operationType)
    }
  }, [operationType])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onCancel])

  // Focus trap
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return

    const drawer = drawerRef.current
    const focusableElements = drawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    firstElement?.focus()

    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-[99] transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed right-0 top-0 h-full w-[480px] bg-white z-[100]',
          'transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen 
            ? 'translate-x-0 shadow-[-4px_0_24px_rgba(0,0,0,0.15)] opacity-100' 
            : 'translate-x-full shadow-none opacity-0'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h2 id="drawer-title" className="text-lg font-semibold text-gray-900">
            {editingIndex !== null ? 'Edit Transformation' : 'Add Transformation'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ height: 'calc(100vh - 80px)' }}>
          {(operationType || selectedOpType) ? (
            <OperationWizard
              fileId={fileId}
              sheetName={sheetName}
              columns={columns}
              operationType={operationType || selectedOpType || ''}
              onApply={onApply}
              onCancel={onCancel}
            />
          ) : (
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">Select an operation type to configure:</p>
              <div className="space-y-2">
                {[
                  { type: 'filter', name: 'Filter Rows', desc: 'Filter rows based on conditions' },
                  { type: 'sort', name: 'Sort', desc: 'Sort rows by columns' },
                  { type: 'replace', name: 'Find & Replace', desc: 'Replace values in columns' },
                  { type: 'math', name: 'Math Operations', desc: 'Add, subtract, multiply, divide' },
                  { type: 'text_cleanup', name: 'Text Cleanup', desc: 'Trim, lowercase, uppercase' },
                  { type: 'remove_duplicates', name: 'Remove Duplicates', desc: 'Remove duplicate rows' },
                  { type: 'select_columns', name: 'Select Columns', desc: 'Choose which columns to keep' },
                  { type: 'aggregate', name: 'Aggregate', desc: 'Sum, average, count, etc.' },
                ].map((op) => (
                  <button
                    key={op.type}
                    onClick={() => {
                      if (onOperationTypeSelect) {
                        onOperationTypeSelect(op.type)
                      } else {
                        setSelectedOpType(op.type)
                      }
                    }}
                    className="w-full text-left p-3 border border-gray-300 rounded-lg hover:border-[#217346] hover:bg-[#217346]/5 transition-colors"
                  >
                    <div className="font-medium text-sm text-gray-900">{op.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{op.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
