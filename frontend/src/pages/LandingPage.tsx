/**
 * Landing / Dashboard: hero, action cards, recent transformations.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileSpreadsheet, Merge, Zap, ArrowRight, History, Trash2, FileJson, FileText, Shield, Table2 } from 'lucide-react'
import { InteractiveDemo } from '@/components/InteractiveDemo'
import { getRecentTransformations, clearRecentTransformations } from '@/lib/storage'
import { loadPipelines, type SavedPipeline } from '@/lib/supabase-pipelines'
import type { RecentTransformation } from '@/lib/storage'
import { useProfile } from '@/context/ProfileContext'

const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 },
  },
}

const heroItemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export function LandingPage() {
  const [recent, setRecent] = useState<RecentTransformation[]>([])
  const [savedPipelines, setSavedPipelines] = useState<SavedPipeline[]>([])
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 300], [0, 80])
  const { ref: statsRef, inView: statsInView } = useInView({ threshold: 0.3, triggerOnce: true })
  const { config } = useProfile()

  useEffect(() => {
    setRecent(getRecentTransformations())
    // Load pipelines from Supabase (with localStorage fallback)
    loadPipelines().then((pipelines) => {
      setSavedPipelines(pipelines)
    }).catch(() => {
      // Fallback handled in loadPipelines
      setSavedPipelines([])
    })
  }, [])

  const handleClearHistory = () => {
    clearRecentTransformations()
    setRecent([])
    setClearHistoryOpen(false)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString()
  }

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div ref={heroRef} className="relative overflow-hidden rounded-b-2xl px-6 py-16 text-white shadow-lg">
        {/* Animated gradient background with parallax */}
        <motion.div
          className="absolute inset-0 rounded-b-2xl bg-gradient-to-br from-[#217346] via-[#1a5a38] to-[#0d331f] animate-gradient"
          style={{ y: heroY }}
        />
        {/* Floating decorative icons */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-b-2xl">
          <FileSpreadsheet className="absolute left-[10%] top-[20%] h-6 w-6 opacity-20 animate-float" style={{ animationDelay: '0s' }} />
          <FileSpreadsheet className="absolute right-[15%] top-[30%] h-8 w-8 opacity-20 animate-float" style={{ animationDelay: '1s' }} />
          <FileSpreadsheet className="absolute left-[20%] bottom-[25%] h-6 w-6 opacity-20 animate-float" style={{ animationDelay: '2s' }} />
          <FileSpreadsheet className="absolute right-[25%] bottom-[30%] h-12 w-12 opacity-20 animate-float" style={{ animationDelay: '0.5s' }} />
          <FileSpreadsheet className="absolute left-[50%] top-[15%] h-8 w-8 opacity-20 animate-float" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl">
          <motion.div
            className="text-center"
            variants={heroContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.h1
              className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
              variants={heroItemVariants}
            >
              Transform Excel data without code
            </motion.h1>
            <motion.p
              className="mt-4 text-base text-white/90 sm:text-lg"
              variants={heroItemVariants}
            >
              Upload, preview, build transformation pipelines, and download results — all in one place.
            </motion.p>
            <motion.p
              className="mt-2 text-sm text-white/70"
              variants={heroItemVariants}
            >
              .xlsx only · Automatic header detection · 17+ operations
            </motion.p>

            {/* Stats counters (animate when in view) */}
            <motion.div
              ref={statsRef}
              className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
              variants={heroItemVariants}
            >
              <div className="text-center transition-all duration-300 hover:text-white">
                <div className="text-4xl font-bold">
                  {statsInView && <CountUp end={10000} duration={2} separator="," suffix="+" />}
                  {!statsInView && <>0</>}
                </div>
                <div className="mt-1 text-sm text-white/80">Files Transformed</div>
              </div>
              <div className="text-center transition-all duration-300 hover:text-white">
                <div className="text-4xl font-bold">
                  {statsInView && <CountUp end={17} duration={2} />}
                  {!statsInView && <>0</>}
                </div>
                <div className="mt-1 text-sm text-white/80">Operations Available</div>
              </div>
              <div className="text-center transition-all duration-300 hover:text-white">
                <div className="text-4xl font-bold">
                  <span className="text-5xl">0</span>
                </div>
                <div className="mt-1 text-sm text-white/80">Code Required</div>
              </div>
            </motion.div>

            {/* CTA buttons */}
            <motion.div
              className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"
              variants={heroItemVariants}
            >
              <Button
                asChild
                size="lg"
                className="bg-white font-semibold text-[#217346] hover:bg-white/90"
              >
                <Link to="/upload/single">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <InteractiveDemo
                className="border-white text-white hover:bg-white hover:text-[#217346] font-semibold"
              />
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              className="mt-12 flex justify-center"
              variants={heroItemVariants}
            >
              <span className="inline-flex flex-col items-center gap-1 text-white/60">
                <span className="text-xs">Scroll to explore</span>
                <motion.span
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <ArrowRight className="h-5 w-5 rotate-90" />
                </motion.span>
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Action cards */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          <Link to="/upload/single" className="block transition-transform hover:scale-[1.02]" data-tour="landing-transform-single">
            <Card className="h-full border-2 border-transparent shadow-sm transition-all hover:border-primary hover:shadow-md">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Transform Single File</CardTitle>
                <CardDescription>
                  Upload one Excel file, preview sheets, build a pipeline, and download the result.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button variant="outline" className="w-full gap-2" size="lg">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </Link>

          {config.features.showBatchProcessing && (
            <Link to="/upload/batch" className="block transition-transform hover:scale-[1.02]">
              <Card className="h-full border-2 border-transparent shadow-sm transition-all hover:border-primary hover:shadow-md">
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Batch Process Files</CardTitle>
                  <CardDescription>
                    Apply the same transformation pipeline to multiple files and download as ZIP.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )}

          {config.features.showMergeFiles && (
            <Link to="/upload/merge" className="block transition-transform hover:scale-[1.02]">
              <Card className="h-full border-2 border-transparent shadow-sm transition-all hover:border-primary hover:shadow-md">
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Merge className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Merge Multiple Files</CardTitle>
                  <CardDescription>
                    Append, join, or union multiple Excel files into one.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Social proof / compatibility */}
        <div className="mt-16">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Works with your existing workflows
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="h-6 w-6" />
              <span className="text-sm font-medium">Microsoft Excel</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Table2 className="h-6 w-6" />
              <span className="text-sm font-medium">Google Sheets</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="h-6 w-6" />
              <span className="text-sm font-medium">CSV Export</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-6 w-6" />
              <span className="text-sm font-medium">100% Secure</span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            All processing happens in your browser. Your data never leaves your device.
          </p>
        </div>

        <Separator className="my-8" />

        {/* Recent transformations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="h-5 w-5 text-muted-foreground" />
              Recent transformations
            </h2>
            <div className="flex items-center gap-2">
              <Link to="/history">
                <Button variant="outline" size="sm">
                  View All History
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              {recent.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setClearHistoryOpen(true)} className="text-muted-foreground">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          {recent.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileJson className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No recent transformations yet</p>
                <p className="text-xs text-muted-foreground">Transform a file to see it here</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Operations</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.fileName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.operationsCount} steps</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(r.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        {/* Saved pipelines (if any) */}
        {savedPipelines.length > 0 && (
          <>
            <Separator className="my-8" />
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <FileJson className="h-5 w-5 text-muted-foreground" />
                Saved pipelines
              </h2>
              <div className="flex flex-wrap gap-2">
                {savedPipelines.slice(0, 5).map((p) => (
                  <Link key={p.id} to={`/pipeline?load=${p.id}`}>
                    <Badge variant="outline" className="cursor-pointer px-3 py-1.5 hover:bg-muted">
                      {p.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={clearHistoryOpen} onOpenChange={setClearHistoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear recent history?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all recent transformations from this list. Your files and pipelines are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
