import { useCallback, useEffect, useRef, useState } from 'react'
import { friendlyError } from '../lib/feedback'

export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)

  const reload = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    setError(null)
    try {
      const next = await load()
      if (id === request.current) setData(next)
    } catch (reason) {
      if (id === request.current)
        setError(friendlyError(reason, 'load content'))
    } finally {
      if (id === request.current) setLoading(false)
    }
    // Callers pass stable module-level loaders; deps intentionally control refresh identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void reload()
    return () => {
      request.current++
    }
  }, [reload])
  return { data, error, loading, reload, setData }
}
