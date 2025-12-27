function logInfo(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

function logWarn(...args) {
  const timestamp = new Date().toISOString();
  console.warn(`[${timestamp}]`, ...args);
}

function logError(...args) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}]`, ...args);
}

module.exports = { logInfo, logWarn, logError };
