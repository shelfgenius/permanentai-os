/**
 * [OPERATOR_OS] — Tactical logger.
 *
 * All console output in the app flows through this module so we can:
 *  - Tag every line with a consistent [OPERATOR_OS] prefix
 *  - Attach a subsystem tag (auth | mappy | tts | oauth | tunnel …)
 *  - Silence noisy debug logs in production by setting VITE_LOG_LEVEL=warn
 *
 * Usage:
 *    import { logger } from '../lib/logger.js';
 *    const log = logger('auth');
 *    log.info('user signed in', user.email);
 *    log.warn('backend slow');
 *    log.error('supabase failed', err);
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
const CURRENT_LEVEL =
  LEVELS[(import.meta.env?.VITE_LOG_LEVEL || 'info').toLowerCase()] ?? 1;

const COLORS = {
  debug: '#6b7280',
  info:  '#0a84ff',
  warn:  '#ff9f0a',
  error: '#ff453a',
};

function emit(level, subsystem, args) {
  if (LEVELS[level] < CURRENT_LEVEL) return;
  const prefix  = `%c[OPERATOR_OS]%c[${subsystem}]`;
  const tagCss  = `color:${COLORS[level]};font-weight:600;`;
  const subCss  = 'color:#9ca3af;font-weight:400;';
  // eslint-disable-next-line no-console
  const method = level === 'debug' ? 'log' : level;
  // eslint-disable-next-line no-console
  console[method](prefix, tagCss, subCss, ...args);
}

export function logger(subsystem = 'core') {
  return {
    debug: (...a) => emit('debug', subsystem, a),
    info:  (...a) => emit('info',  subsystem, a),
    warn:  (...a) => emit('warn',  subsystem, a),
    error: (...a) => emit('error', subsystem, a),
  };
}

// Root logger for misc/uncategorized messages
export const log = logger('core');
