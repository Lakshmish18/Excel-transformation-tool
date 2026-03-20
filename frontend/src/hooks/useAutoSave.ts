import { useEffect, useRef } from 'react'
import { useDebounce } from './useDebounce'

interface UseAutoSaveOptions {
  data: unknown
  onSave: (data: unknown) => void
  delay?: number
  enabled?: boolean
}

export function useAutoSave({
  data,
  onSave,
  delay = 30000,
  enabled = true,
}: UseAutoSaveOptions) {
  const debouncedData = useDebounce(data, delay)
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (enabled && debouncedData) {
      onSave(debouncedData)
    }
  }, [debouncedData, onSave, enabled])
}
