import { NextResponse } from "next/server";
import { LogLevel } from "@prisma/client";
import { isAdminAuthorized } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const levelParam = url.searchParams.get("level")?.toUpperCase();
    const search = url.searchParams.get("search")?.trim() || "";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);

    const where: Record<string, unknown> = {};

    if (levelParam && levelParam !== "ALL" && (Object.values(LogLevel) as string[]).includes(levelParam)) {
      where.level = levelParam as LogLevel;
    }

    if (search) {
      where.OR = [
        { message: { contains: search, mode: "insensitive" } },
        { source: { contains: search, mode: "insensitive" } },
      ];
    }

    const [logs, total, infoCount, warnCount, errorCount] = await Promise.all([
      prisma.systemLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.systemLog.count({ where }),
      prisma.systemLog.count({ where: { level: LogLevel.INFO } }),
      prisma.systemLog.count({ where: { level: LogLevel.WARN } }),
      prisma.systemLog.count({ where: { level: LogLevel.ERROR } }),
    ]);

    return NextResponse.json({
      logs,
      total,
      limit,
      offset,
      summary: {
        total: infoCount + warnCount + errorCount,
        info: infoCount,
        warn: warnCount,
        error: errorCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch system logs", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const levelStr = (body.level || "INFO").toUpperCase();
    const level = (Object.values(LogLevel) as string[]).includes(levelStr) ? (levelStr as LogLevel) : LogLevel.INFO;
    const message = String(body.message || "Manual admin log entry");
    const source = body.source ? String(body.source) : "admin_panel";
    const meta = typeof body.meta === "object" ? body.meta : { createdBy: "admin" };

    if (level === LogLevel.ERROR) {
      await logger.error(message, meta, source);
    } else if (level === LogLevel.WARN) {
      await logger.warn(message, meta, source);
    } else {
      await logger.info(message, meta, source);
    }

    return NextResponse.json({ success: true, message: "Log created successfully" });
  } catch (error) {
    console.error("Failed to create log entry", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to create log" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    await prisma.systemLog.deleteMany({});
    await logger.info("System logs cleared by admin", {}, "admin/logs");
    return NextResponse.json({ success: true, message: "System logs cleared" });
  } catch (error) {
    console.error("Failed to clear system logs", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to clear logs" }, { status: 500 });
  }
}
