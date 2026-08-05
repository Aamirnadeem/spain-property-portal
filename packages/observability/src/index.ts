export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

function level(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
  if (raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error') return raw;
  return 'info';
}

const order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function shouldLog(wanted: LogLevel): boolean {
  return order[wanted] >= order[level()];
}

function emit(wanted: LogLevel, message: string, fields?: LogFields): void {
  if (!shouldLog(wanted)) return;
  const payload = {
    ts: new Date().toISOString(),
    level: wanted,
    message,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (wanted === 'error') console.error(line);
  else if (wanted === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

export function createRequestLogger(correlationId: string) {
  return {
    info: (message: string, fields?: LogFields) =>
      logger.info(message, { correlationId, ...fields }),
    warn: (message: string, fields?: LogFields) =>
      logger.warn(message, { correlationId, ...fields }),
    error: (message: string, fields?: LogFields) =>
      logger.error(message, { correlationId, ...fields }),
  };
}
