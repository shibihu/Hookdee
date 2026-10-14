import "server-only";

import { getServerEnv } from "../env.server";
import crypto from "crypto";

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

export function generateAdminTokenForSecret(secret: string): string {
  return crypto.createHmac("sha256", secret).update("hookdee-admin-auth-session-v1").digest("hex");
}

export function generateAdminToken(): string {
  return generateAdminTokenForSecret(getExpectedAdminSecret());
}

export async function getActiveAdminToken(): Promise<string | null> {
  const secret = getExpectedAdminSecret();
  return secret ? generateAdminTokenForSecret(secret) : null;
}

export async function setActiveAdminToken(): Promise<void> {
  // Retained for interface compatibility
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  const secret = getExpectedAdminSecret();
  if (!secret) return false;

  const validToken = generateAdminTokenForSecret(secret);

  const headerKey = request.headers.get("x-admin-key")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const cookieToken = cookies[ADMIN_COOKIE_NAME]?.trim();

  const providedTokens = [headerKey, bearerToken, cookieToken].filter(Boolean);

  if (providedTokens.length === 0) {
    return false;
  }

  for (const provided of providedTokens) {
    if (provided === secret || provided === validToken) {
      return true;
    }
  }

  return false;
}
