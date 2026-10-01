import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '../lib/feedback'
import { useFeedback } from '../components/Feedback'
import { CHANGED_EVENT } from '../lib/trash'
import { dataCache, previewCache, CACHE_RESET } from '../lib/cache'
import {
  DELETED_EVENT,
  removeDeletedRecord,
  type DeletedRecord,
} from '../lib/deletion'

const keys = new WeakMap<Function, string>()
let sequence = 0
function cacheKey(load: Function) {
  if (!keys.has(load)) keys.set(load, String(++sequence))
  return keys.get(load)!
}

export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const key = cacheKey(load)
  const [data, setData] = useState<T | null>(
    () => (dataCache.peek(key) as T) ?? null,
  )
  const [loading, setLoading] = useState(
    () => dataCache.peek(key) === undefined,
  )
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const { notify } = useFeedback()
  const warned = useRef(false)
  const lastData = useRef(data)
  lastData.current = data

  const reload = useCallback(async (force = true) => {
    if (force) dataCache.clear()
    const id = ++request.current
    setLoading(lastData.current === null)
    setError(null)
    try {
      const next = (await dataCache.get(key, load)) as T
      warned.current = false
      if (id === request.current) setData(next)
    } catch (reason) {
      if (id === request.current) {
        const message = friendlyError(reason, 'load content')
        if (!lastData.current) setError(message)
        else if (!warned.current) {
          warned.current = true
          notify(
            `Could not refresh. Showing previously loaded content. ${message}`,
            'warning',
          )
        }
      }
    } finally {
      if (id === request.current) setLoading(false)
    }
    // Callers pass stable module-level loaders; deps intentionally control refresh identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void reload(false)
    const refresh = (event: Event) => {
      const { id } = (event as CustomEvent<DeletedRecord>).detail
      previewCache.clear()
      setData((current) => removeDeletedRecord(current, id))
      void reload()
    }
    window.addEventListener(DELETED_EVENT, refresh)
    const changed = () => {
      previewCache.clear()
      void reload()
    }
    const reset = () => {
      request.current++
      setData(null)
      setLoading(true)
      setError(null)
    }
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const timer = window.setInterval(refreshVisible, 60_000)
    window.addEventListener('focus', refreshVisible)
    window.addEventListener(CACHE_RESET, reset)
    window.addEventListener(CHANGED_EVENT, changed)
    return () => {
      window.removeEventListener(DELETED_EVENT, refresh)
      window.removeEventListener(CHANGED_EVENT, changed)
      window.removeEventListener('focus', refreshVisible)
      window.removeEventListener(CACHE_RESET, reset)
      window.clearInterval(timer)
      request.current++
    }
  }, [reload])
  return { data, error, loading, reload, setData }
}
