import { NextResponse } from "next/server";
import { isAdminAuthorized } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    const globalUnlimitedSetting = await prisma.systemSetting.findUnique({
      where: { key: "unlimited_quota" },
    });

    const isGlobalUnlimited = globalUnlimitedSetting?.value === "true";

    const [buckets, bucketCount, users, unlimitedUsersCount] = await Promise.all([
      prisma.rateLimitBucket.findMany({
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.rateLimitBucket.count(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          hasUnlimitedQuota: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.user.count({ where: { hasUnlimitedQuota: true } }),
    ]);

    return NextResponse.json({
      globalUnlimited: isGlobalUnlimited,
      rateLimitBuckets: buckets,
      totalBuckets: bucketCount,
      users,
      totalUnlimitedUsers: unlimitedUsersCount,
    });
  } catch (error) {
    console.error("Failed to fetch quota data", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to fetch quota data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, enabled, userId } = body;

    if (action === "toggle_global_unlimited") {
      const isEnabled = Boolean(enabled);
      await prisma.systemSetting.upsert({
        where: { key: "unlimited_quota" },
        create: { key: "unlimited_quota", value: isEnabled ? "true" : "false" },
        update: { value: isEnabled ? "true" : "false" },
      });

      await logger.info(`Global unlimited quota ${isEnabled ? "ENABLED" : "DISABLED"} by admin`, { enabled: isEnabled }, "admin/quota");

      return NextResponse.json({
        success: true,
        globalUnlimited: isEnabled,
        message: `Global unlimited quota ${isEnabled ? "enabled" : "disabled"}`,
      });
    }

    if (action === "set_user_unlimited" && userId) {
      const isEnabled = Boolean(enabled);
      const user = await prisma.user.update({
        where: { id: userId },
        data: { hasUnlimitedQuota: isEnabled },
        select: { id: true, email: true, name: true, hasUnlimitedQuota: true },
      });

      await logger.info(`User ${user.email || user.id} unlimited quota set to ${isEnabled}`, { userId, enabled: isEnabled }, "admin/quota");

      return NextResponse.json({
        success: true,
        user,
        message: `User unlimited quota updated`,
      });
    }

    return NextResponse.json({ code: "BAD_REQUEST", message: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to update quota configuration", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to update quota settings" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminAuthorized(request))) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Admin access required" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const bucketId = url.searchParams.get("bucketId");

    if (bucketId) {
      await prisma.rateLimitBucket.delete({ where: { id: bucketId } });
      await logger.info(`Rate limit bucket ${bucketId} reset by admin`, { bucketId }, "admin/quota");
    } else {
      await prisma.rateLimitBucket.deleteMany({});
      await logger.info("All rate limit buckets reset by admin", {}, "admin/quota");
    }

    return NextResponse.json({ success: true, message: "Rate limit buckets reset successfully" });
  } catch (error) {
    console.error("Failed to reset rate limit buckets", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "Failed to reset rate limits" }, { status: 500 });
  }
}
