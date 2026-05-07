const c = {
  blue: "\x1b[34m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  reset: "\x1b[0m"
}

const tag = (color: string, label: string) => `${color}${label}${c.reset}`

export const log = {
  info: (...args: any[]) => console.info(tag(c.blue, "[info]"), ...args),

  error: (...args: any[]) => console.error(tag(c.red, "[error]"), ...args),

  warn: (...args: any[]) => console.warn(tag(c.yellow, "[warn]"), ...args),

  debug: (...args: any[]) => console.debug(tag(c.magenta, "[debug]"), ...args)
}
