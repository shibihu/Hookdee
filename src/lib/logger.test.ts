import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./prisma", () => ({ prisma: {} }));

import { LogLevel } from "@prisma/client";
import { logger, logSystemEvent } from "./logger";

describe("logger utility", () => {
  it("logs to console and calls writeToDb", async () => {
    const writeToDb = vi.fn().mockResolvedValue(undefined);
    const logToConsole = vi.fn();

    await logSystemEvent(
      LogLevel.INFO,
      "Test message",
      { foo: "bar" },
      "test_source",
      { writeToDb, logToConsole },
    );

    expect(logToConsole).toHaveBeenCalledWith(
      LogLevel.INFO,
      "Test message",
      { foo: "bar" },
    );

    expect(writeToDb).toHaveBeenCalledWith({
      level: LogLevel.INFO,
      message: "Test message",
      source: "test_source",
      meta: { foo: "bar" },
    });
  });

  it("handles info, warn, error logger methods", async () => {
    const writeToDb = vi.fn().mockResolvedValue(undefined);
    const logToConsole = vi.fn();
    const deps = { writeToDb, logToConsole };

    await logger.info("Info msg", { key: 1 }, "src1", deps);
    await logger.warn("Warn msg", { key: 2 }, "src2", deps);
    await logger.error("Error msg", { key: 3 }, "src3", deps);

    expect(writeToDb).toHaveBeenCalledTimes(3);
    expect(writeToDb).toHaveBeenNthCalledWith(1, {
      level: LogLevel.INFO,
      message: "Info msg",
      source: "src1",
      meta: { key: 1 },
    });
    expect(writeToDb).toHaveBeenNthCalledWith(2, {
      level: LogLevel.WARN,
      message: "Warn msg",
      source: "src2",
      meta: { key: 2 },
    });
    expect(writeToDb).toHaveBeenNthCalledWith(3, {
      level: LogLevel.ERROR,
      message: "Error msg",
      source: "src3",
      meta: { key: 3 },
    });
  });
});
