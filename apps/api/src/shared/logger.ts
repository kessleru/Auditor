import { pino } from 'pino';
import { env } from '../config/env.js';

const defaultLevel = env.NODE_ENV === 'test' ? 'silent' : 'info';

export const logger = pino({
  level: env.LOG_LEVEL ?? defaultLevel,
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } },
  }),
});
