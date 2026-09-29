import { useCallback, useEffect, useState } from 'react'
import { messageFrom } from '../lib/showcase'

export function useAsyncData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await load())
    } catch (reason) {
      setError(messageFrom(reason))
    } finally {
      setLoading(false)
    }
  // Callers pass stable module-level loaders; deps intentionally control refresh identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload, setData }
}
