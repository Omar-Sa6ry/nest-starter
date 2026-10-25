import { Injectable, LoggerService } from '@nestjs/common';
import { LoggerContext } from './logger.context.js';

const SENSITIVE_KEY =
  /pass(?:word|wd|phrase)|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|authorization|cookie|credential|webhook/i;

@Injectable()
export class StructuredLogger implements LoggerService {
  static redactText(text: string): string {
    return text
      .replace(
        /(https?:\/\/[^\s"'<>]*\/(?:api\/)?webhooks?\/(?:\d+\/)?)[^\s"'<>/]+/gi,
        '$1***',
      )
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer ***')
      .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]*/g, '***')
      .replace(
        /\b(password|passwd|passphrase|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|authorization|cookie|credential)(\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&)}\]]+)/gi,
        '$1$2***',
      );
  }

  private redactDeep(value: unknown): unknown {
    if (typeof value === 'string') return StructuredLogger.redactText(value);
    if (Array.isArray(value)) return value.map((v) => this.redactDeep(v));
    if (value instanceof Error || value instanceof Date) return value;
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = SENSITIVE_KEY.test(k) ? '***' : this.redactDeep(v);
      }
      return out;
    }
    return value;
  }

  private isEnabled(level: 'DEBUG' | 'VERBOSE' | 'INFO' | 'WARN' | 'ERROR') {
    const ranks: Record<string, number> = {
      debug: 0,
      verbose: 0,
      info: 1,
      warn: 2,
      warning: 2,
      error: 3,
    };
    const configured = (
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    )
      .toLowerCase()
      .trim();
    const minRank = ranks[configured] ?? ranks.info;
    const rank =
      level === 'INFO'
        ? ranks.info
        : (ranks[level.toLowerCase()] ?? ranks.info);
    return rank >= minRank;
  }

  private formatMessage(level: string, message: unknown, context?: string) {
    const store = LoggerContext.getStore() || {};
    const safeMessage =
      typeof message === 'object' && message !== null
        ? this.redactDeep(message)
        : StructuredLogger.redactText(String(message));
    const safeContext = StructuredLogger.redactText(context || 'Application');
    const logObj = {
      timestamp: new Date().toISOString(),
      level,
      context: safeContext,
      message:
        typeof safeMessage === 'object' && safeMessage !== null
          ? safeMessage
          : { text: String(safeMessage) },
      ...(this.redactDeep(store) as typeof store),
    };

    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify(logObj);
    } else {
      const traceInfo = logObj.traceId ? ` [TraceID: ${logObj.traceId}]` : '';
      const ctxInfo = logObj.context ? ` [${logObj.context}]` : '';
      const text =
        typeof safeMessage === 'object' && safeMessage !== null
          ? JSON.stringify(safeMessage, null, 2)
          : String(safeMessage);

      let color = '\x1b[0m'; // Reset
      if (level === 'ERROR') color = '\x1b[31m'; // Red
      if (level === 'WARN') color = '\x1b[33m'; // Yellow
      if (level === 'INFO') color = '\x1b[32m'; // Green
      if (level === 'DEBUG') color = '\x1b[35m'; // Magenta
      if (level === 'VERBOSE') color = '\x1b[36m'; // Cyan

      return `${color}[${level}] ${logObj.timestamp}${traceInfo}${ctxInfo}: ${text}\x1b[0m`;
    }
  }

  log(message: unknown, context?: string) {
    if (!this.isEnabled('INFO')) return;
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: unknown, trace?: string, context?: string) {
    if (!this.isEnabled('ERROR')) return;
    console.error(this.formatMessage('ERROR', message, context || trace));
    if (trace && process.env.NODE_ENV !== 'production') {
      console.error(StructuredLogger.redactText(trace));
    }
  }

  warn(message: unknown, context?: string) {
    if (!this.isEnabled('WARN')) return;
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: unknown, context?: string) {
    if (!this.isEnabled('DEBUG')) return;
    console.log(this.formatMessage('DEBUG', message, context));
  }

  verbose(message: unknown, context?: string) {
    if (!this.isEnabled('VERBOSE')) return;
    console.log(this.formatMessage('VERBOSE', message, context));
  }
}
