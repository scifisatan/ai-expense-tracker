export const log = {
  info: (...args: any[]) => console.info('[info]', ...args),
  error: (...args: any[]) => console.error('[error]', ...args),
  warn: (...args: any[]) => console.warn('[warn]', ...args),
  debug: (...args: any[]) => console.debug('[debug]', ...args),
};
