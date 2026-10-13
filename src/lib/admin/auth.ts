import "server-only";

import { getServerEnv } from "../env.server";

export const ADMIN_COOKIE_NAME = "hookdee_admin_session";

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  for (const item of cookieHeader.split(";")) {
    const [k, ...v] = item.trim().split("=");
    if (k) cookies[k] = decodeURIComponent(v.join("="));
  }
  return cookies;
}

export function getExpectedAdminSecret(): string {
  try {
    const env = getServerEnv();
    return env.ADMIN_SECRET ?? env.AUTH_SECRET;
  } catch {
    return process.env.ADMIN_SECRET ?? process.env.AUTH_SECRET ?? "default-admin-secret-dev";
  }
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  const secret = getExpectedAdminSecret();

  // 1. Check x-admin-key header
  const headerKey = request.headers.get("x-admin-key");
  if (headerKey && headerKey === secret) {
    return true;
  }

  // 2. Check admin session cookie
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const sessionToken = cookies[ADMIN_COOKIE_NAME];

  if (sessionToken && sessionToken === secret) {
    return true;
  }

  return false;
}
