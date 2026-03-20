/**
 * Authentication component for Supabase
 */
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { toast } from 'sonner'
import { Loader2, LogIn, UserPlus, LogOut } from 'lucide-react'

export function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      return
    }

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Supabase not configured</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To enable authentication, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env
            file.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    if (!supabase) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Check your email to confirm your account!')
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      console.error('Sign up error:', error)
      toast.error('Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  const handleSignIn = async () => {
    if (!email || !password) {
      toast.error('Please enter email and password')
      return
    }
    if (!supabase) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Signed in successfully!')
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      console.error('Sign in error:', error)
      toast.error('Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Signed out successfully')
      }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Signed In
          </CardTitle>
          <CardDescription>You are signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSignOut} disabled={loading} variant="outline" className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4 mr-2" />
            )}
            Sign Out
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSignUp ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </CardTitle>
        <CardDescription>
          {isSignUp
            ? 'Create an account to save pipelines and view history'
            : 'Sign in to access your saved pipelines and history'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="auth-email">Email</Label>
          <Input
            id="auth-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password">Password</Label>
          <Input
            id="auth-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) {
                isSignUp ? handleSignUp() : handleSignIn()
              }
            }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={isSignUp ? handleSignUp : handleSignIn}
            disabled={loading}
            className="flex-1 bg-[#217346] hover:bg-[#1a5a38]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : isSignUp ? (
              <UserPlus className="h-4 w-4 mr-2" />
            ) : (
              <LogIn className="h-4 w-4 mr-2" />
            )}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </Button>
        </div>
        <div className="text-center">
          <Button
            variant="link"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm"
            disabled={loading}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
