import { broadcastEvent } from '../socket.js';

export interface LogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  meta?: any;
}

const memoryLogs: LogItem[] = [];
const MAX_LOGS = 200;

function formatTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

export const logger = {
  info(message: string, meta?: any) {
    const timeStr = formatTimestamp();
    console.log(`${timeStr} ℹ️ ${message}`, meta ? meta : '');
    const entry: LogItem = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      level: 'info',
      message,
      meta,
    };
    memoryLogs.unshift(entry);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.pop();
    broadcastEvent('worker:log', entry);
  },

  success(message: string, meta?: any) {
    const timeStr = formatTimestamp();
    console.log(`${timeStr} ✅ ${message}`, meta ? meta : '');
    const entry: LogItem = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      level: 'success',
      message,
      meta,
    };
    memoryLogs.unshift(entry);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.pop();
    broadcastEvent('worker:log', entry);
  },

  warn(message: string, meta?: any) {
    const timeStr = formatTimestamp();
    console.warn(`${timeStr} ⚠️ ${message}`, meta ? meta : '');
    const entry: LogItem = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      level: 'warn',
      message,
      meta,
    };
    memoryLogs.unshift(entry);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.pop();
    broadcastEvent('worker:log', entry);
  },

  error(message: string, meta?: any) {
    const timeStr = formatTimestamp();
    console.error(`${timeStr} ❌ ${message}`, meta ? meta : '');
    const entry: LogItem = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: timeStr,
      level: 'error',
      message,
      meta,
    };
    memoryLogs.unshift(entry);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.pop();
    broadcastEvent('worker:log', entry);
  },

  getRecentLogs(): LogItem[] {
    return [...memoryLogs];
  },
};
