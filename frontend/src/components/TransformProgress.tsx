import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface TransformProgressProps {
  totalSteps: number
  currentStep: number
  currentOperation: string
  status: 'running' | 'complete' | 'error'
}

export function TransformProgress({
  totalSteps,
  currentStep,
  currentOperation,
  status,
}: TransformProgressProps) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {status === 'complete' && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          <span className="font-semibold">
            {status === 'running' && 'Processing...'}
            {status === 'complete' && 'Complete!'}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      {currentOperation && (
        <p className="text-sm text-muted-foreground">{currentOperation}</p>
      )}
    </div>
  )
}
