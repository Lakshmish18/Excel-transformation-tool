/**
 * Global quick navigation / actions (Ctrl+K or Cmd+K).
 */
import { Link } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Home, BookOpen, Keyboard, Upload, LayoutDashboard, History } from 'lucide-react'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenShortcuts: () => void
}

export function CommandPalette({ open, onOpenChange, onOpenShortcuts }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick actions</DialogTitle>
          <DialogDescription>
            Navigate or open tools. Press Esc to close.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 py-2">
          <Button variant="ghost" className="justify-start gap-2" asChild onClick={() => onOpenChange(false)}>
            <Link to="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start gap-2" asChild onClick={() => onOpenChange(false)}>
            <Link to="/upload/single">
              <Upload className="h-4 w-4" />
              Upload file
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start gap-2" asChild onClick={() => onOpenChange(false)}>
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start gap-2" asChild onClick={() => onOpenChange(false)}>
            <Link to="/history">
              <History className="h-4 w-4" />
              History
            </Link>
          </Button>
          <Button variant="ghost" className="justify-start gap-2" asChild onClick={() => onOpenChange(false)}>
            <Link to="/docs">
              <BookOpen className="h-4 w-4" />
              Documentation
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="justify-start gap-2"
            onClick={() => {
              onOpenChange(false)
              onOpenShortcuts()
            }}
          >
            <Keyboard className="h-4 w-4" />
            Keyboard shortcuts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
