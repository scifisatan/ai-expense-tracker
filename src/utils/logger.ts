const c = {
  blue: "\x1b[34m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  reset: "\x1b[0m"
} as const

type Level = "info" | "error" | "warn" | "debug" | "success"

const levelColors: Record<Level, string> = {
  info: c.blue,
  error: c.red,
  warn: c.yellow,
  debug: c.magenta,
  success: c.green
}

const levelMethods: Record<Level, keyof Console> = {
  info: "info",
  error: "error",
  warn: "warn",
  debug: "debug",
  success: "log"
}

const tag = (color: string, label: string) => `${color}${label}${c.reset}`

const createLogger = (component: string, componentColor: string) => {
  const componentTag = tag(componentColor, `[${component}]`)

  const logger = {} as Record<Level, (...args: any[]) => void>

  for (const level of Object.keys(levelColors) as Level[]) {
    const levelTag = tag(levelColors[level], `[${level}]`)
    const method = levelMethods[level]

    logger[level] = (...args: any[]) => {
      ;(console[method] as Function).call(console, componentTag, levelTag, ...args)
    }
  }

  return logger
}

export const log = {
  bot: createLogger("bot", c.cyan),
  api: createLogger("api", c.green),
  trpc: createLogger("trpc", c.yellow),
  db: createLogger("db", c.magenta),
  ai: createLogger("ai", c.blue)
}
