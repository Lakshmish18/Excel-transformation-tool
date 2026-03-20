import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield } from 'lucide-react'
import type { DataQuality } from '@/lib/api'

interface DataQualityCardProps {
  quality: DataQuality
}

export function DataQualityCard({ quality }: DataQualityCardProps) {
  const scoreColor =
    quality.overall_score >= 80 ? 'text-green-600' :
    quality.overall_score >= 60 ? 'text-yellow-600' : 'text-red-600'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Data Quality Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <div className={`text-5xl font-bold ${scoreColor}`}>{quality.overall_score}</div>
            <p className="text-sm text-muted-foreground">out of 100</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-2xl font-semibold">{quality.completeness.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-2xl font-semibold">{quality.duplicate_rows}</p>
              <p className="text-xs text-muted-foreground">Duplicates</p>
            </div>
          </div>
          {quality.issues.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Issues Detected:</p>
              {quality.issues.slice(0, 3).map((issue, i) => (
                <Alert key={i} variant={issue.severity === 'high' ? 'destructive' : 'default'}>
                  <AlertDescription className="text-xs">{issue.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
