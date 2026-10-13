import "server-only";

import { LogLevel } from "@prisma/client";
import { prisma } from "./prisma";

export interface LogEntry {
  id?: string;
  level: LogLevel;
  message: string;
  source?: string | null;
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
}

export interface LoggerDependencies {
  writeToDb?: (entry: {
    level: LogLevel;
    message: string;
    source?: string | null;
    meta?: Record<string, unknown> | null;
  }) => Promise<void>;
  logToConsole?: (level: LogLevel, message: string, meta?: unknown) => void;
}

const defaultDependencies: LoggerDependencies = {
  async writeToDb(entry) {
    try {
      await prisma.systemLog.create({
        data: {
          level: entry.level,
          message: entry.message,
          source: entry.source ?? null,
          meta: entry.meta ? JSON.parse(JSON.stringify(entry.meta)) : undefined,
        },
      });
    } catch {
      // Ignore database logging failures to avoid crashing primary workflows
    }
  },
  logToConsole(level, message, meta) {
    const time = new Date().toISOString();
    const tag = `[${time}] [${level}]`;
    if (level === LogLevel.ERROR) {
      console.error(tag, message, meta ?? "");
    } else if (level === LogLevel.WARN) {
      console.warn(tag, message, meta ?? "");
    } else {
      console.info(tag, message, meta ?? "");
    }
  },
};

export async function logSystemEvent(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
  source?: string,
  deps: LoggerDependencies = defaultDependencies,
): Promise<void> {
  const consoleLogger = deps.logToConsole ?? defaultDependencies.logToConsole;
  consoleLogger?.(level, message, meta);

  const dbWriter = deps.writeToDb ?? defaultDependencies.writeToDb;
  if (dbWriter) {
    await dbWriter({ level, message, source: source ?? "system", meta });
  }
}

export const logger = {
  async info(message: string, meta?: Record<string, unknown>, source?: string, deps?: LoggerDependencies) {
    return logSystemEvent(LogLevel.INFO, message, meta, source, deps);
  },
  async warn(message: string, meta?: Record<string, unknown>, source?: string, deps?: LoggerDependencies) {
    return logSystemEvent(LogLevel.WARN, message, meta, source, deps);
  },
  async error(message: string, meta?: Record<string, unknown>, source?: string, deps?: LoggerDependencies) {
    return logSystemEvent(LogLevel.ERROR, message, meta, source, deps);
  },
};
