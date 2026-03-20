/**
 * Smart Column Selector: search, type badges, grouping, recently used, keyboard nav.
 * Single or multi-select; optional sample values in tooltip.
 */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { ChevronDown, Search, Hash, Calendar, Type, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const STORAGE_KEY_RECENT = 'smart-column-selector-recent'
const MAX_RECENT = 3

export type ColumnType = 'number' | 'date' | 'text'

function getColumnType(columnName: string): ColumnType {
  const lower = columnName.toLowerCase()
  const numberKeywords = ['amount', 'price', 'cost', 'revenue', 'profit', 'quantity', 'count', 'total', 'value']
  const dateKeywords = ['date', 'time', 'day', 'month', 'year', 'created', 'updated']
  if (numberKeywords.some((k) => lower.includes(k))) return 'number'
  if (dateKeywords.some((k) => lower.includes(k))) return 'date'
  return 'text'
}

function getRecentColumns(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RECENT)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function pushRecentColumn(column: string): void {
  const recent = getRecentColumns().filter((c) => c !== column)
  recent.unshift(column)
  localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

// Single-select props
export interface SmartColumnSelectorSingleProps {
  columns: string[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  allowMultiple?: false
  sampleValues?: Record<string, string[]>
  id?: string
  disabled?: boolean
}

// Multi-select props
export interface SmartColumnSelectorMultiProps {
  columns: string[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  allowMultiple: true
  sampleValues?: Record<string, string[]>
  id?: string
  disabled?: boolean
}

export type SmartColumnSelectorProps = SmartColumnSelectorSingleProps | SmartColumnSelectorMultiProps

function TypeBadge({ type }: { type: ColumnType }) {
  if (type === 'number')
    return (
      <Badge variant="secondary" className="rounded-full text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <Hash className="h-2.5 w-2.5 mr-0.5" />
        123
      </Badge>
    )
  if (type === 'date')
    return (
      <Badge variant="secondary" className="rounded-full text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
        <Calendar className="h-2.5 w-2.5 mr-0.5" />
        Date
      </Badge>
    )
  return (
    <Badge variant="secondary" className="rounded-full text-[10px] bg-muted text-muted-foreground">
      <Type className="h-2.5 w-2.5 mr-0.5" />
      Abc
    </Badge>
  )
}

function ColumnRow({
  column,
  selected,
  onSelect,
  sampleValues,
  multi,
  onToggleMulti,
  focused,
}: {
  column: string
  selected: boolean
  onSelect: () => void
  sampleValues?: Record<string, string[]>
  multi?: boolean
  onToggleMulti?: () => void
  focused?: boolean
}) {
  const type = getColumnType(column)
  const samples = sampleValues?.[column]
  const sampleStr = samples?.length ? `Sample: ${samples.slice(0, 5).join(', ')}${samples.length > 5 ? '…' : ''}` : undefined

  const content = (
    <div
      role="option"
      aria-selected={selected}
      data-focused={focused}
      onClick={() => (multi ? onToggleMulti?.() : onSelect())}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-all',
        selected && !multi && 'bg-[#217346] text-white',
        selected && multi && 'bg-[#217346]/10',
        !selected && 'hover:bg-muted/80',
        focused && 'ring-1 ring-[#217346] ring-inset'
      )}
    >
      {multi && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input">
          {selected ? <Check className="h-3 w-3 text-[#217346]" /> : null}
        </span>
      )}
      <TypeBadge type={type} />
      <span className="flex-1 truncate">{column}</span>
    </div>
  )

  if (sampleStr)
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {sampleStr}
        </TooltipContent>
      </Tooltip>
    )
  return content
}

export function SmartColumnSelector(props: SmartColumnSelectorProps) {
  const {
    columns,
    placeholder = 'Select column',
    sampleValues,
    id,
    disabled = false,
  } = props
  const isMulti = props.allowMultiple === true
  const value = props.value
  const onValueChange = props.onValueChange

  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedSet = useMemo(() => {
    if (isMulti && Array.isArray(value)) return new Set(value as string[])
    if (!isMulti && typeof value === 'string' && value) return new Set([value])
    return new Set<string>()
  }, [isMulti, value])

  const recent = useMemo(() => getRecentColumns().filter((c) => columns.includes(c)), [columns])
  const filtered = useMemo(
    () => columns.filter((col) => col.toLowerCase().includes(search.toLowerCase().trim())),
    [columns, search]
  )

  const grouped = useMemo(() => {
    const num: string[] = []
    const date: string[] = []
    const text: string[] = []
    filtered.forEach((col) => {
      const t = getColumnType(col)
      if (t === 'number') num.push(col)
      else if (t === 'date') date.push(col)
      else text.push(col)
    })
    return { number: num, date, text }
  }, [filtered])

  const recentInFiltered = useMemo(
    () => recent.filter((c) => filtered.includes(c)),
    [recent, filtered]
  )
  const notRecent = useCallback(
    (list: string[]) => list.filter((c) => !recentInFiltered.includes(c)),
    [recentInFiltered]
  )
  const displayList = useMemo(
    () => [...recentInFiltered, ...notRecent(grouped.number), ...notRecent(grouped.date), ...notRecent(grouped.text)],
    [recentInFiltered, grouped, notRecent]
  )

  const selectSingle = useCallback(
    (col: string) => {
      void (onValueChange as (v: string) => void)(col)
      pushRecentColumn(col)
      setOpen(false)
      setSearch('')
    },
    [onValueChange]
  )

  const toggleMulti = useCallback(
    (col: string) => {
      const arr = (value as string[]).slice()
      const idx = arr.indexOf(col)
      if (idx >= 0) arr.splice(idx, 1)
      else arr.push(col)
      void (onValueChange as (v: string[]) => void)(arr)
      pushRecentColumn(col)
    },
    [value, onValueChange]
  )

  const selectAll = useCallback(() => {
    void (onValueChange as (v: string[]) => void)([...filtered])
  }, [filtered, onValueChange])

  const clearAll = useCallback(() => {
    void (onValueChange as (v: string[]) => void)([])
  }, [onValueChange])

  useEffect(() => {
    if (!open) return
    setFocusedIndex(0)
  }, [open, search])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (!el) return
    const opts = el.querySelectorAll('[role="option"]')
    const node = opts[focusedIndex] as HTMLElement | undefined
    node?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex, open, displayList.length])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, displayList.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const col = displayList[focusedIndex]
        if (col) {
          if (isMulti) toggleMulti(col)
          else selectSingle(col)
        }
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, focusedIndex, displayList, isMulti, selectSingle, toggleMulti])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const displayValue = isMulti
    ? (value as string[]).length
      ? `${(value as string[]).length} column(s) selected`
      : placeholder
    : (value as string) || placeholder

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'h-10 w-full justify-between font-normal transition-all',
          'border-input bg-background hover:bg-muted/50',
          'focus-visible:ring-2 focus-visible:ring-[#217346]/50'
        )}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown className={cn('h-4 w-4 opacity-50 shrink-0 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[var(--radix-popper-anchor-width)] max-h-[280px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md transition-all"
          style={{ minWidth: triggerRef.current?.offsetWidth }}
        >
          <div className="sticky top-0 border-b bg-background p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search columns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            {isMulti && (
              <div className="flex gap-1 mt-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                  Select all
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>
                  Clear all
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-y-auto max-h-[220px] p-1" role="listbox">
            {recentInFiltered.length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Recently used</div>
                {recentInFiltered.map((col) => (
                  <ColumnRow
                    key={col}
                    column={col}
                    selected={selectedSet.has(col)}
                    onSelect={() => selectSingle(col)}
                    sampleValues={sampleValues}
                    multi={isMulti}
                    onToggleMulti={isMulti ? () => toggleMulti(col) : undefined}
                    focused={displayList.indexOf(col) === focusedIndex}
                  />
                ))}
              </div>
            )}
            {notRecent(grouped.number).length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Numbers</div>
                {notRecent(grouped.number).map((col) => (
                  <ColumnRow
                    key={col}
                    column={col}
                    selected={selectedSet.has(col)}
                    onSelect={() => selectSingle(col)}
                    sampleValues={sampleValues}
                    multi={isMulti}
                    onToggleMulti={isMulti ? () => toggleMulti(col) : undefined}
                    focused={displayList.indexOf(col) === focusedIndex}
                  />
                ))}
              </div>
            )}
            {notRecent(grouped.date).length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Dates</div>
                {notRecent(grouped.date).map((col) => (
                  <ColumnRow
                    key={col}
                    column={col}
                    selected={selectedSet.has(col)}
                    onSelect={() => selectSingle(col)}
                    sampleValues={sampleValues}
                    multi={isMulti}
                    onToggleMulti={isMulti ? () => toggleMulti(col) : undefined}
                    focused={displayList.indexOf(col) === focusedIndex}
                  />
                ))}
              </div>
            )}
            {notRecent(grouped.text).length > 0 && (
              <div className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Text</div>
                {notRecent(grouped.text).map((col) => (
                  <ColumnRow
                    key={col}
                    column={col}
                    selected={selectedSet.has(col)}
                    onSelect={() => selectSingle(col)}
                    sampleValues={sampleValues}
                    multi={isMulti}
                    onToggleMulti={isMulti ? () => toggleMulti(col) : undefined}
                    focused={displayList.indexOf(col) === focusedIndex}
                  />
                ))}
              </div>
            )}
            {displayList.length === 0 && (
              <div className="py-4 text-center text-sm text-muted-foreground">No columns match</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
