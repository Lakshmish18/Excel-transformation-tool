/**
 * Friendly error page: user-facing message, actions, and optional technical details.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Home, RotateCcw, Bug } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ErrorRecoveryProps {
  title: string
  message: string
  technicalDetails?: string
  onRetry?: () => void
  onGoBack?: () => void
}

const REPORT_EMAIL = 'support@example.com'

function copyToClipboard(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => {})
}

export function ErrorRecovery({
  title,
  message,
  technicalDetails,
  onRetry,
  onGoBack,
}: ErrorRecoveryProps) {
  const [techOpen, setTechOpen] = useState(false)

  const handleReportIssue = () => {
    const body = technicalDetails
      ? `Error details:\n\n${technicalDetails}`
      : title && message
        ? `Error: ${title}\n\n${message}`
        : 'Please describe the issue.'
    const mailto = `mailto:${REPORT_EMAIL}?subject=Excel%20Transformation%20Tool%20-%20Error%20Report&body=${encodeURIComponent(body)}`
    if (technicalDetails) copyToClipboard(technicalDetails)
    window.location.href = mailto
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md border-destructive/50 transition-all duration-200">
        <CardHeader className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-lg text-destructive">{title}</CardTitle>
              <CardDescription className="text-sm">{message}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                className="bg-[#217346] hover:bg-[#1a5a38]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            {onGoBack && (
              <Button variant="outline" onClick={onGoBack}>
                <Home className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleReportIssue}>
              <Bug className="mr-2 h-4 w-4" />
              Report Issue
            </Button>
          </div>

          {technicalDetails && (
            <div className="rounded-md border border-border">
              <button
                type="button"
                onClick={() => setTechOpen((o) => !o)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
                )}
              >
                Technical Details
                <span className="text-xs">{techOpen ? '▼' : '▶'}</span>
              </button>
              {techOpen && (
                <pre className="max-h-40 overflow-auto border-t border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground">
                  {technicalDetails}
                </pre>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/** Map common error types to friendly title and message. */
export function getFriendlyError(error: unknown): { title: string; message: string } {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()

  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('econnrefused')) {
    return {
      title: 'Connection problem',
      message: 'Unable to connect to server. Check your internet connection.',
    }
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return {
      title: 'Not found',
      message: "The file or resource you're looking for doesn't exist.",
    }
  }
  if (lower.includes('500') || lower.includes('internal server')) {
    return {
      title: 'Server error',
      message: 'Something went wrong on our end. Please try again.',
    }
  }
  if (lower.includes('validation') || lower.includes('invalid') && (lower.includes('field') || lower.includes('column'))) {
    return {
      title: 'Validation error',
      message: "Some data doesn't meet requirements. Check the highlighted fields.",
    }
  }
  if (lower.includes('too large') || lower.includes('file size') || lower.includes('50mb')) {
    return {
      title: 'File too large',
      message: 'This file is too large. Maximum size is 50MB.',
    }
  }
  if (lower.includes('xlsx') || lower.includes('file type') || lower.includes('invalid file')) {
    return {
      title: 'Invalid file type',
      message: 'Please upload an Excel (.xlsx) or CSV (.csv) file.',
    }
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. You can go back home and try again.',
  }
}
