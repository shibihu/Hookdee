import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE } from "@/lib/auth/google";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const item of cookieHeader.split(";")) {
    const [k, ...v] = item.trim().split("=");
    if (k) cookies[k] = decodeURIComponent(v.join("="));
  }
  return cookies;
}

export async function GET(request: Request) {
  try {
    const cookies = parseCookieHeader(request.headers.get("cookie"));
    const sessionToken = cookies[USER_SESSION_COOKIE];

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const dbSession = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            hasUnlimitedQuota: true,
          },
        },
      },
    });

    if (!dbSession || dbSession.expires < new Date()) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({ authenticated: true, user: dbSession.user });
  } catch {
    return NextResponse.json({ authenticated: false, user: null });
  }
}
