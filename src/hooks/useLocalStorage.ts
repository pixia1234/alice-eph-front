import { useEffect, useState } from 'react'

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

function readValue<T>(key: string, defaultValue: T): T {
  if (!canUseStorage()) return defaultValue
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return defaultValue
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('Failed to parse stored value, falling back to default.', error)
    return defaultValue
  }
}

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => readValue(key, defaultValue))

  useEffect(() => {
    if (!canUseStorage()) return
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.warn('Failed to persist value for key.', error)
    }
  }, [key, value])

  return [value, setValue] as const
}
