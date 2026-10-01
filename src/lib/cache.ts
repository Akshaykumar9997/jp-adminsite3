// Session-only LRU/TTL cache. Failed loads and invalidated in-flight responses
// cannot repopulate it; private data is never written to persistent storage.
export class MemoryCache<T> {
  private entries = new Map<string, { value: T; expires: number }>()
  private pending = new Map<string, Promise<T>>()
  private generation = 0
  private limit: number
  private ttl: number
  constructor(limit: number, ttl: number) {
    this.limit = limit
    this.ttl = ttl
  }
  peek(key: string): T | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }
  async get(key: string, load: () => Promise<T>) {
    const cached = this.peek(key)
    if (cached !== undefined) return cached
    const existing = this.pending.get(key)
    if (existing) return existing
    const generation = this.generation
    const promise = load()
      .then((value) => {
        if (generation === this.generation) {
          this.entries.set(key, { value, expires: Date.now() + this.ttl })
          while (this.entries.size > this.limit)
            this.entries.delete(this.entries.keys().next().value!)
        }
        return value
      })
      .finally(() => {
        if (this.pending.get(key) === promise) this.pending.delete(key)
      })
    this.pending.set(key, promise)
    return promise
  }
  clear() {
    this.generation++
    this.entries.clear()
    this.pending.clear()
  }
}
export const previewCache = new MemoryCache<string>(512, 240_000)
export const dataCache = new MemoryCache<unknown>(8, 300_000)
export const CACHE_RESET = 'cms:cache-reset'
export function clearCmsCaches() {
  previewCache.clear()
  dataCache.clear()
  window.dispatchEvent(new Event(CACHE_RESET))
}
