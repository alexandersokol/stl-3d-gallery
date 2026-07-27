import { describe, it, expect } from 'vitest'
import { createLimiter, thumbnailLimiter } from './concurrency'

describe('createLimiter', () => {
  it('never runs more than `max` tasks concurrently, and every task resolves with its own result', async () => {
    const limit = createLimiter(3)
    let running = 0
    let maxObservedRunning = 0

    const makeTask = (i: number) => async () => {
      running++
      maxObservedRunning = Math.max(maxObservedRunning, running)
      // Yield a couple of microtask/timer turns so overlapping calls have a
      // real chance to run concurrently if the limiter were broken.
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return i * 2
    }

    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => limit(makeTask(i))))

    expect(maxObservedRunning).toBeLessThanOrEqual(3)
    expect(maxObservedRunning).toBe(3) // confirms the cap is actually exercised, not just never hit
    expect(running).toBe(0)
    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i * 2))
  })

  it('propagates a rejection to its own caller without blocking other queued work', async () => {
    const limit = createLimiter(2)

    const outcomes = await Promise.allSettled([
      limit(() => Promise.reject(new Error('boom'))),
      limit(() => Promise.resolve('ok-1')),
      limit(() => Promise.resolve('ok-2')),
    ])

    expect(outcomes[0]).toMatchObject({ status: 'rejected', reason: new Error('boom') })
    expect(outcomes[1]).toEqual({ status: 'fulfilled', value: 'ok-1' })
    expect(outcomes[2]).toEqual({ status: 'fulfilled', value: 'ok-2' })
  })

  it('queues tasks beyond the cap and runs them once a slot frees up', async () => {
    const limit = createLimiter(1)
    const order: number[] = []

    const makeTask = (i: number) => async () => {
      order.push(i)
      await new Promise((resolve) => setTimeout(resolve, 1))
      return i
    }

    const results = await Promise.all([1, 2, 3].map((i) => limit(makeTask(i))))

    expect(order).toEqual([1, 2, 3]) // strictly serialized with max=1
    expect(results).toEqual([1, 2, 3])
  })

  it('exports a shared thumbnailLimiter capped at 4', async () => {
    let running = 0
    let maxObservedRunning = 0

    const makeTask = () => async () => {
      running++
      maxObservedRunning = Math.max(maxObservedRunning, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return true
    }

    await Promise.all(Array.from({ length: 8 }, () => thumbnailLimiter(makeTask())))

    expect(maxObservedRunning).toBeLessThanOrEqual(4)
    expect(maxObservedRunning).toBe(4)
  })
})
