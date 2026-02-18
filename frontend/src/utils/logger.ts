// UrbanFix AI — Frontend Logger
// Logs to console with timestamps, categories, and emoji for easy scanning

const isDev = __DEV__;

type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'action';

const ICONS: Record<LogLevel, string> = {
  info:    '📋',
  warn:    '⚠️',
  error:   '❌',
  success: '✅',
  action:  '👆',
};

function timestamp() {
  const now = new Date();
  return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`;
}

function log(level: LogLevel, category: string, message: string, data?: any) {
  if (!isDev) return;
  const prefix = `${ICONS[level]} [${timestamp()}] [${category}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export const logger = {
  info:    (cat: string, msg: string, data?: any) => log('info',    cat, msg, data),
  warn:    (cat: string, msg: string, data?: any) => log('warn',    cat, msg, data),
  error:   (cat: string, msg: string, data?: any) => log('error',   cat, msg, data),
  success: (cat: string, msg: string, data?: any) => log('success', cat, msg, data),
  action:  (cat: string, msg: string, data?: any) => log('action',  cat, msg, data),

  // Convenience: log a button press
  tap: (screen: string, button: string, data?: any) =>
    log('action', screen, `Button tapped: "${button}"`, data),

  // Convenience: log an API call start
  apiReq: (method: string, url: string, body?: any) =>
    log('info', 'API', `→ ${method.toUpperCase()} ${url}`, body),

  // Convenience: log an API response
  apiRes: (method: string, url: string, status: number, data?: any) =>
    log(status < 400 ? 'success' : 'error', 'API', `← ${status} ${method.toUpperCase()} ${url}`, data),
};

export default logger;
