import "server-only";

import { getServerEnv } from "../env.server";
import { prisma } from "../prisma";
import crypto from "crypto";

export const ADMIN_COOKIE_NAME = "hookdee_admin_session";
export const ADMIN_TOKEN_SETTING_KEY = "admin_active_token";

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

export function generateAdminToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 characters hex
}

export async function getActiveAdminToken(): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: ADMIN_TOKEN_SETTING_KEY },
    });
    return setting?.value ?? null;
  } catch {
    return null;
  }
}

export async function setActiveAdminToken(token: string): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key: ADMIN_TOKEN_SETTING_KEY },
      create: { key: ADMIN_TOKEN_SETTING_KEY, value: token },
      update: { value: token },
    });
  } catch (error) {
    console.error("Failed to set active admin token", error);
  }
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  const secret = getExpectedAdminSecret();
  const activeToken = await getActiveAdminToken();

  const headerKey = request.headers.get("x-admin-key");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const cookieToken = cookies[ADMIN_COOKIE_NAME];

  const providedTokens = [headerKey, bearerToken, cookieToken].filter(Boolean);

  for (const provided of providedTokens) {
    if (provided === secret) return true;
    if (activeToken && provided === activeToken) return true;
  }

  return false;
}
