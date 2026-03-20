import { useProfile } from '@/context/ProfileContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function ProfileSettings() {
  const { config, showProfileSelector } = useProfile()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{config.icon}</span>
          <div>
            <h3 className="font-semibold text-lg">{config.name}</h3>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Active Features:</p>
          <div className="flex flex-wrap gap-2">
            {config.features.showKPIs && <Badge>KPI Dashboard</Badge>}
            {config.features.showBatchProcessing && <Badge>Batch Processing</Badge>}
            {config.features.showAdvancedOperations && <Badge>All Operations</Badge>}
            {config.features.showDataQuality && <Badge>Data Quality</Badge>}
            {config.features.showColumnProfiling && <Badge>Column Profiling</Badge>}
            {config.features.showDashboard && <Badge>Dashboard</Badge>}
          </div>
        </div>

        <div className="p-3 bg-muted rounded">
          <p className="text-sm">
            <strong>Max file size:</strong> {config.features.maxFileSize}MB
          </p>
          <p className="text-sm">
            <strong>Operations:</strong>{' '}
            {config.features.showAdvancedOperations
              ? 'All 17'
              : `${config.features.recommendedOperations.length} essential`}
          </p>
        </div>

        <Button onClick={showProfileSelector} variant="outline" className="w-full">
          Change Profile
        </Button>
      </CardContent>
    </Card>
  )
}

