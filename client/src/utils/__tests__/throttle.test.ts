import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { throttle } from '../throttle'

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('executes the function immediately on first call', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled()

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not execute again within the throttle window', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled() // immediate
    throttled() // should be scheduled, not immediate
    throttled() // should replace scheduled

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('executes trailing call after the throttle window expires', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled() // immediate at t=0
    throttled() // queued

    vi.advanceTimersByTime(50)

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('passes the latest arguments to the trailing call', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled('first')   // immediate
    throttled('second')  // queued
    throttled('third')   // replaces queued — trailing should use 'third'

    vi.advanceTimersByTime(50)

    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('third')
  })

  it('allows execution again after the throttle window', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled() // t=0 — immediate
    vi.advanceTimersByTime(60)

    throttled() // t=60 — immediate again (window passed)

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('maintains steady throughput at the throttle interval', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    // Simulate 10 rapid calls over 500ms
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(50)
      throttled()
    }

    // Should have executed roughly 10 times (once per 50ms window)
    expect(fn).toHaveBeenCalledTimes(10)
  })

  it('cancel() stops any pending trailing call', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 50)

    throttled() // immediate
    throttled() // queued

    throttled.cancel()
    vi.advanceTimersByTime(100)

    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('works correctly with a 0ms interval (no throttle)', () => {
    const fn = vi.fn()
    const throttled = throttle(fn, 0)

    throttled()
    throttled()
    throttled()

    expect(fn).toHaveBeenCalledTimes(3)
  })
})
