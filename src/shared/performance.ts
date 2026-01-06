export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startMeasure(label: string): () => void {
    const startTime = performance.now()

    return () => {
      const endTime = performance.now()
      const duration = endTime - startTime

      if (!this.metrics.has(label)) {
        this.metrics.set(label, [])
      }

      this.metrics.get(label)!.push(duration)
    }
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } | null {
    const times = this.metrics.get(label)
    if (!times || times.length === 0) return null

    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const min = Math.min(...times)
    const max = Math.max(...times)

    return { avg, min, max, count: times.length }
  }

  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {}

    for (const [label] of this.metrics) {
      const metrics = this.getMetrics(label)
      if (metrics) {
        result[label] = metrics
      }
    }

    return result
  }

  reset(): void {
    this.metrics.clear()
  }
}

export class SimpleCache<T> {
  private cache: Map<string, { value: T; timestamp: number }> = new Map()
  private ttl: number

  constructor(ttlMs: number = 5 * 60 * 1000) {
    this.ttl = ttlMs
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  get(key: string): T | null {
    const item = this.cache.get(key)

    if (!item) return null

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)

    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

export const memoize = <T extends (...args: any[]) => any>(func: T): T => {
  const cache = new Map()

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args)

    if (cache.has(key)) {
      return cache.get(key)
    }

    const result = func(...args)
    cache.set(key, result)

    return result
  }) as T
}
