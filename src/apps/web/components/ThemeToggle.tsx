import { Moon, Sun } from "lucide-react"
import { Button } from "@web/components/ui/button"
import { useTheme } from "@web/hooks/useTheme"

// System-aware light/dark switch. Foundation-owned so every surface shares it.
const ThemeToggle = () => {
  const { resolvedTheme, toggle } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  )
}

export default ThemeToggle
