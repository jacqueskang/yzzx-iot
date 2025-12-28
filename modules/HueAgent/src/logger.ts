
function safeSpread(args: unknown[]): unknown[] {
  return Array.isArray(args) ? args : [args];
}

export function logInfo(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...safeSpread(args));
}

export function logWarn(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}]`, ...safeSpread(args));
}

export function logError(...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...safeSpread(args));
}
