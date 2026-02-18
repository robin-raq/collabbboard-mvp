/**
 * Throttle — limits function execution to at most once per `ms` milliseconds.
 *
 * Unlike debounce (which waits until activity stops), throttle provides a
 * steady stream of calls at a fixed interval. This is ideal for continuous
 * visual feedback like cursor position updates.
 *
 * @param fn   The function to throttle
 * @param ms   Minimum interval between calls in milliseconds
 * @returns    A throttled version of the function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T & { cancel: () => void } {
  let lastCall = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastArgs: unknown[] | null = null

  const throttled = (...args: unknown[]) => {
    const now = Date.now()
    const remaining = ms - (now - lastCall)
    lastArgs = args

    if (remaining <= 0) {
      // Enough time has passed — execute immediately
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      lastCall = now
      lastArgs = null
      fn(...args)
    } else if (!timer) {
      // Schedule a trailing call so the last position is always sent
      timer = setTimeout(() => {
        lastCall = Date.now()
        timer = null
        const argsToUse = lastArgs
        lastArgs = null
        if (argsToUse) fn(...argsToUse)
      }, remaining)
    }
  }

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return throttled as T & { cancel: () => void }
}
