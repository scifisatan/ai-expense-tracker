import { useCallback, useEffect, useState } from "react"

export type ThemeChoice = "light" | "dark" | "system"

const STORAGE_KEY = "theme"

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches

const readStored = (): ThemeChoice => {
  if (typeof localStorage === "undefined") return "system"
  const v = localStorage.getItem(STORAGE_KEY)
  return v === "light" || v === "dark" ? v : "system"
}

// Resolve a choice to the concrete mode and toggle the `dark` class on <html>.
const applyTheme = (choice: ThemeChoice) => {
  const dark = choice === "dark" || (choice === "system" && systemPrefersDark())
  document.documentElement.classList.toggle("dark", dark)
  return dark ? "dark" : "light"
}

/**
 * System-aware light/dark theme. Persists an explicit choice to localStorage;
 * "system" follows the OS preference live. The initial class is set pre-paint by
 * the inline script in the SSR shell (see apps/web/index.tsx) to avoid a flash.
 */
export const useTheme = () => {
  const [choice, setChoice] = useState<ThemeChoice>(() => readStored())
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  )

  useEffect(() => {
    setResolved(applyTheme(choice))
  }, [choice])

  // Follow live OS changes while on "system".
  useEffect(() => {
    if (choice !== "system") return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => setResolved(applyTheme("system"))
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [choice])

  const setTheme = useCallback((next: ThemeChoice) => {
    if (next === "system") localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
    setChoice(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(resolved === "dark" ? "light" : "dark")
  }, [resolved, setTheme])

  return { theme: choice, resolvedTheme: resolved, setTheme, toggle }
}
