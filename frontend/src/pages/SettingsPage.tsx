import { ProfileSettings } from '@/components/ProfileSettings'

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ProfileSettings />
    </div>
  )
}

