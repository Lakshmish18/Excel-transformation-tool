/**
 * App layout: header, optional breadcrumb/stepper, help menu, and main content (Outlet).
 */
import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { StepIndicator } from '@/components/StepIndicator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FileSpreadsheet, Home, HelpCircle, Keyboard, BookOpen, Bug, History, User, Film } from 'lucide-react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { GuidedTour, getTourCompleted, setTourCompleted } from '@/components/GuidedTour'
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts'
import { CommandPalette } from '@/components/CommandPalette'
import { Auth } from '@/components/Auth'
import { restartProductTour } from '@/components/ProductTour'
import { useProfile } from '@/context/ProfileContext'

interface BreadcrumbItem {
  label: string
  path?: string
}

function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-gray-400">/</span>}
          {item.path ? (
            <Link to={item.path} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItem[] = [{ label: 'Home', path: '/' }]
  let acc = ''
  for (let i = 0; i < segments.length; i++) {
    acc += '/' + segments[i]
    const label = segments[i].charAt(0).toUpperCase() + segments[i].slice(1)
    items.push(i === segments.length - 1 ? { label } : { label, path: acc })
  }
  return items
}

function getCurrentStep(pathname: string): number {
  if (pathname === '/' || pathname.startsWith('/upload')) return 1
  if (pathname.startsWith('/preview')) return 2
  if (pathname.startsWith('/pipeline')) return 3
  if (pathname.startsWith('/results') || pathname.startsWith('/batch') || pathname.startsWith('/merge')) return 4
  return 1
}

const REPORT_EMAIL = 'mailto:support@example.com?subject=Excel%20Transformation%20Tool%20Feedback'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const isLanding = pathname === '/'
  const breadcrumbs = getBreadcrumbs(pathname)
  const currentStep = getCurrentStep(pathname)

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [tourRun, setTourRun] = useState(false)
  const { config, showProfileSelector } = useProfile()

  useEffect(() => {
    if (!getTourCompleted()) setTourRun(true)
  }, [])

  const handleOpenProductTour = () => {
    restartProductTour()
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      setCommandPaletteOpen((o) => !o)
      return
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      e.preventDefault()
      setShortcutsOpen((o) => !o)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleRestartGuidedTour = () => {
    setTourCompleted(false)
    setTourRun(true)
  }

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-white">
      <Toaster position="top-right" richColors closeButton />
      <ErrorBoundary fallback={<></>}>
        <GuidedTour run={tourRun} onComplete={() => setTourRun(false)} />
      </ErrorBoundary>
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />
      {/* Header */}
      <header className="bg-[#217346] text-white shadow-sm">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-2">
            <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-semibold">Excel Data Transformation Tool</h1>
            </Link>
            <div className="flex items-center gap-1">
              {config.features.showDashboard && (
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" title="Dashboard">
                    Dashboard
                  </Button>
                </Link>
              )}
              <Link to="/history">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" title="View transformation history">
                  <History className="h-4 w-4 mr-1" />
                  History
                </Button>
              </Link>
              <button
                type="button"
                onClick={showProfileSelector}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full hover:bg-white/20 transition text-sm font-medium"
              >
                <span>{config.icon}</span>
                <span>{config.name}</span>
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" aria-label="Account">
                    <User className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80">
                  <Auth />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" aria-label="Help">
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={() => setShortcutsOpen(true)}>
                      <Keyboard className="h-4 w-4" />
                      Keyboard Shortcuts
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={handleOpenProductTour}>
                      <Film className="h-4 w-4" />
                      Product Tour
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start gap-2" onClick={handleRestartGuidedTour}>
                      <HelpCircle className="h-4 w-4" />
                      In-App Tour
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={() => navigate('/docs')}>
                      <BookOpen className="h-4 w-4" />
                      Documentation
                    </Button>
                    <a href={REPORT_EMAIL}>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2">
                        <Bug className="h-4 w-4" />
                        Report Issue
                      </Button>
                    </a>
                  </div>
                </PopoverContent>
              </Popover>
              {!isLanding && (
                <Link to="/">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <Home className="h-4 w-4 mr-1" />
                    New
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar: breadcrumb + stepper */}
      {!isLanding && (
        <div className="bg-[#F2F2F2] border-b border-gray-300 px-6 py-2 flex flex-wrap items-center justify-between gap-2">
          <Breadcrumb items={breadcrumbs} />
          <StepIndicator currentStep={currentStep} />
        </div>
      )}

      <main className={isLanding ? '' : 'flex flex-col'} style={isLanding ? {} : { minHeight: 'calc(100vh - 120px)' }}>
        <Outlet />
      </main>
    </div>
    </TooltipProvider>
  )
}
