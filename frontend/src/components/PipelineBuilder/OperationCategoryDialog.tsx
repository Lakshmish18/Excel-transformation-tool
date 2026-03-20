/**
 * Progressive disclosure: category selection → operation selection.
 * User picks a category, then an operation, then "Configure" opens the config dialog.
 */
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft } from 'lucide-react'
import { OPERATION_CATEGORIES, OPERATION_HELP, type CategoryDef } from './operationsConfig'
import { HelpTooltip } from '@/components/HelpTooltip'
import { cn } from '@/lib/utils'
import { useProfile } from '@/context/ProfileContext'

interface OperationCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOperation: (operationType: string) => void
}

export function OperationCategoryDialog({
  open,
  onOpenChange,
  onSelectOperation,
}: OperationCategoryDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryDef | null>(null)
  const { config } = useProfile()

  const filteredCategories = useMemo(() => {
    if (config.features.showAdvancedOperations) {
      return OPERATION_CATEGORIES
    }
    const allowed = new Set(config.features.recommendedOperations)
    return OPERATION_CATEGORIES
      .map((cat) => ({
        ...cat,
        operations: cat.operations.filter((op) => allowed.has(op.type)),
      }))
      .filter((cat) => cat.operations.length > 0)
  }, [config])

  const handleBack = () => setSelectedCategory(null)

  const handleConfigure = (operationType: string) => {
    onSelectOperation(operationType)
    onOpenChange(false)
    setSelectedCategory(null)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) setSelectedCategory(null)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg transition-all duration-200">
        <DialogHeader>
          {selectedCategory ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute left-4 top-4 -ml-1 h-8"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <DialogTitle className="pt-8">
                {selectedCategory.title} Operations
              </DialogTitle>
              <DialogDescription>
                Choose an operation to configure and add to your pipeline.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Add Operation</DialogTitle>
              <DialogDescription>
                Choose a category to see available operations.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {!selectedCategory ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {filteredCategories.map((cat) => {
              const Icon = cat.icon
              return (
                <Card
                  key={cat.id}
                  className={cn(
                    'cursor-pointer transition-all duration-200',
                    'hover:border-[#217346] hover:shadow-md',
                    'border border-border'
                  )}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <CardContent className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{cat.title}</p>
                        <Badge variant="secondary" className="rounded-full text-xs mt-0.5">
                          {cat.operations.length} operation{cat.operations.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
            {selectedCategory.operations.map((op) => {
              const OpIcon = op.icon
              return (
                <Card
                  key={op.type}
                  className={cn(
                    'transition-all duration-200',
                    'border border-border hover:border-muted-foreground/30'
                  )}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                        <OpIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">{op.label}</p>
                        <p className="text-sm text-muted-foreground truncate">{op.description}</p>
                      </div>
                      <HelpTooltip
                        title={op.label}
                        content={OPERATION_HELP[op.type] ?? op.description}
                        side="left"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="shrink-0 bg-[#217346] hover:bg-[#217346]/90"
                      onClick={() => handleConfigure(op.type)}
                    >
                      Configure
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
