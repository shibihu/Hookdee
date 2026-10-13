import { NextResponse } from "next/server";
import { LogLevel } from "@prisma/client";
import { isAdminAuthorized } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    let geminiConfigured = false;
    let authSecretConfigured = false;
    try {
      const env = getServerEnv();
      geminiConfigured = Boolean(env.GEMINI_API_KEY);
      authSecretConfigured = Boolean(env.AUTH_SECRET);
    } catch {
      geminiConfigured = Boolean(process.env.GEMINI_API_KEY);
      authSecretConfigured = Boolean(process.env.AUTH_SECRET);
    }

    let dbConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    const [
      aiLogsCount,
      aiLogsAggregate,
      infoLogs,
      warnLogs,
      errorLogs,
      usersCount,
      scriptsCount,
      reviewsCount,
      activeBucketsCount,
    ] = await Promise.all([
      prisma.aIRequestLog.count().catch(() => 0),
      prisma.aIRequestLog.aggregate({
        _sum: {
          inputTokens: true,
          outputTokens: true,
          estimatedCostUsd: true,
        },
      }).catch(() => ({ _sum: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: null } })),
      prisma.systemLog.count({ where: { level: LogLevel.INFO } }).catch(() => 0),
      prisma.systemLog.count({ where: { level: LogLevel.WARN } }).catch(() => 0),
      prisma.systemLog.count({ where: { level: LogLevel.ERROR } }).catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.script.count().catch(() => 0),
      prisma.review.count().catch(() => 0),
      prisma.rateLimitBucket.count().catch(() => 0),
    ]);

    const totalTokens = (aiLogsAggregate._sum.inputTokens || 0) + (aiLogsAggregate._sum.outputTokens || 0);
    const totalCostUsd = aiLogsAggregate._sum.estimatedCostUsd ? Number(aiLogsAggregate._sum.estimatedCostUsd) : 0;

    return NextResponse.json({
      health: {
        databaseConnected: dbConnected,
        geminiConfigured,
        authSecretConfigured,
      },
      aiMetrics: {
        totalRequests: aiLogsCount,
        inputTokens: aiLogsAggregate._sum.inputTokens || 0,
        outputTokens: aiLogsAggregate._sum.outputTokens || 0,
        totalTokens,
        estimatedCostUsd: totalCostUsd,
      },
      logMetrics: {
        total: infoLogs + warnLogs + errorLogs,
        info: infoLogs,
        warn: warnLogs,
        error: errorLogs,
      },
      appMetrics: {
        users: usersCount,
        scripts: scriptsCount,
        reviews: reviewsCount,
        rateLimitBuckets: activeBucketsCount,
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin stats", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to load statistics" }, { status: 500 });
  }
}
