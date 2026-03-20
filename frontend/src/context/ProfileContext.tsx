import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { PROFILE_CONFIGS, type UserProfile, type ProfileConfig } from '@/types/profiles'
import { ProfileSelector } from '@/components/ProfileSelector'

interface ProfileContextType {
  profile: UserProfile
  config: ProfileConfig
  setProfile: (profile: UserProfile) => void
  showProfileSelector: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>('general')
  const [showSelector, setShowSelector] = useState(false)

  useEffect(() => {
    try {
      const saved = (typeof window !== 'undefined'
        ? window.localStorage.getItem('userProfile')
        : null) as UserProfile | null
      if (saved && PROFILE_CONFIGS[saved]) {
        setProfileState(saved)
      } else {
        setShowSelector(true)
      }
    } catch {
      setShowSelector(true)
    }
  }, [])

  const setProfile = (newProfile: UserProfile) => {
    setProfileState(newProfile)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('userProfile', newProfile)
      }
      // Optional analytics hook
      const anyWindow = window as typeof window & {
        analytics?: { track?: (event: string, props?: Record<string, unknown>) => void }
      }
      anyWindow.analytics?.track?.('Profile Selected', {
        profile: newProfile,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // ignore storage/analytics failures
    }
    setShowSelector(false)
  }

  const showProfileSelector = () => {
    setShowSelector(true)
  }

  const config = PROFILE_CONFIGS[profile]

  return (
    <ProfileContext.Provider value={{ profile, config, setProfile, showProfileSelector }}>
      {children}
      <ProfileSelector open={showSelector} onSelect={setProfile} currentProfile={profile} />
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider')
  }
  return context
}

