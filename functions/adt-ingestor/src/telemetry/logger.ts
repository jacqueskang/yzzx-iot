export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelOrder: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';

export const logger = {
  debug: (msg: string, props?: Record<string, unknown>) => {
    if (levelOrder[LOG_LEVEL] <= levelOrder.debug) console.debug(JSON.stringify({ level: 'debug', msg, ...props }));
  },
  info: (msg: string, props?: Record<string, unknown>) => {
    if (levelOrder[LOG_LEVEL] <= levelOrder.info) console.info(JSON.stringify({ level: 'info', msg, ...props }));
  },
  warn: (msg: string, props?: Record<string, unknown>) => {
    if (levelOrder[LOG_LEVEL] <= levelOrder.warn) console.warn(JSON.stringify({ level: 'warn', msg, ...props }));
  },
  error: (msg: string, props?: Record<string, unknown>) => {
    if (levelOrder[LOG_LEVEL] <= levelOrder.error) console.error(JSON.stringify({ level: 'error', msg, ...props }));
  }
};
