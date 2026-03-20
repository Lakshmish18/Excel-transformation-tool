/* eslint-disable no-console */
/**
 * Development-safe logger. In production, log/debug/info are no-ops.
 * console.error always runs (for Sentry integration later).
 */
const isDev = import.meta.env.DEV

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
    // TODO: Send to error tracking (Sentry, LogRocket, etc.)
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args)
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args)
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info(...args)
  },
}
