import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import { PROFILE_CONFIGS, type UserProfile } from '@/types/profiles'

interface ProfileSelectorProps {
  open: boolean
  onSelect: (profile: UserProfile) => void
  currentProfile?: UserProfile
}

export function ProfileSelector({ open, onSelect, currentProfile }: ProfileSelectorProps) {
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(currentProfile || null)

  const handleConfirm = () => {
    if (selectedProfile) {
      onSelect(selectedProfile)
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose Your Profile</DialogTitle>
          <DialogDescription>
            Select the profile that best matches your use case. This will customize the features you
            see.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-bold mb-2">Welcome! 👋</h2>
          <p className="text-muted-foreground text-sm">
            To give you the best experience, we&apos;ll customize the tool based on how you plan to
            use it. Choose the profile that best matches your needs:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {Object.values(PROFILE_CONFIGS).map((profile) => (
            <Card
              key={profile.id}
              className={`cursor-pointer transition-all ${
                selectedProfile === profile.id
                  ? 'border-primary border-2 bg-primary/5'
                  : 'hover:border-primary/50'
              }`}
              onClick={() => setSelectedProfile(profile.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">{profile.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {profile.description}
                      </CardDescription>
                    </div>
                  </div>
                  {selectedProfile === profile.id && <Check className="h-5 w-5 text-primary" />}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Perfect for:</p>
                  <p className="text-sm">{profile.sampleUseCase}</p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Features included:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {profile.features.showKPIs && (
                      <Badge variant="secondary" className="text-xs">
                        KPI Dashboard
                      </Badge>
                    )}
                    {profile.features.showBatchProcessing && (
                      <Badge variant="secondary" className="text-xs">
                        Batch Processing
                      </Badge>
                    )}
                    {profile.features.showAdvancedOperations && (
                      <Badge variant="secondary" className="text-xs">
                        Advanced Ops
                      </Badge>
                    )}
                    {profile.features.showDataQuality && (
                      <Badge variant="secondary" className="text-xs">
                        Data Quality
                      </Badge>
                    )}
                    {!profile.features.showKPIs &&
                      !profile.features.showBatchProcessing &&
                      !profile.features.showAdvancedOperations &&
                      !profile.features.showDataQuality && (
                        <Badge variant="secondary" className="text-xs">
                          Essential Tools
                        </Badge>
                      )}
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Max file size: <strong>{profile.features.maxFileSize}MB</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedProfile && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-semibold text-blue-900 mb-2">
              💡 Tips for {PROFILE_CONFIGS[selectedProfile].name}:
            </p>
            <ul className="text-sm text-blue-800 space-y-1">
              {PROFILE_CONFIGS[selectedProfile].tips.map((tip, i) => (
                <li key={i}>• {tip}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between items-center mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">You can change this anytime in settings</p>
          <Button onClick={handleConfirm} disabled={!selectedProfile} size="lg">
            Continue with{' '}
            {selectedProfile ? PROFILE_CONFIGS[selectedProfile].name : 'selected profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

