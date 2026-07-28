// Small promise-based concurrency limiter. `createLimiter(max)` returns a
// function that runs at most `max` of the async callbacks passed to it at
// once; anything beyond that sits in a FIFO queue until a slot frees up.
//
// Used to bound how many expensive thumbnail-generation pipelines (file
// read -> STL parse worker -> GPU render -> disk write) run in parallel
// when a grid full of tiles all become visible at once.

type Task = () => void

export function createLimiter(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let active = 0
  const queue: Task[] = []

  const runNext = () => {
    if (active >= max) return
    const next = queue.shift()
    if (!next) return
    active++
    next()
  }

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(
          (value) => {
            active--
            resolve(value)
            runNext()
          },
          (err) => {
            active--
            reject(err)
            runNext()
          },
        )
      })
      runNext()
    })
  }
}

export const thumbnailLimiter = createLimiter(4)
