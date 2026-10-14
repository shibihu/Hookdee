import "server-only";

import crypto from "crypto";
import { logger } from "../logger";
import { prisma } from "../prisma";

export const ADMIN_COOKIE_NAME = "hookdee_admin_session";
export const PENDING_2FA_COOKIE_NAME = "hookdee_admin_pending_2fa";
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000;

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
  const secret = process.env.ADMIN_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("Admin authentication secret is not configured");
  }
  return secret;
}

export function verifyAdminSecret(provided: string): boolean {
  if (!provided) return false;

  const expectedHash = crypto.createHash("sha256").update(getExpectedAdminSecret()).digest();
  const providedHash = crypto.createHash("sha256").update(provided).digest();
  return crypto.timingSafeEqual(providedHash, expectedHash);
}

function hashAdminSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  try {
    await prisma.adminSession.create({
      data: {
        tokenHash: hashAdminSessionToken(token),
        expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
      },
    });
  } catch (error) {
    void logger.error("Failed to create admin session", { operation: "create" }, "admin/auth");
    throw error;
  }
  return token;
}

export async function revokeAdminSession(token: string | null | undefined): Promise<void> {
  if (!token) return;

  try {
    await prisma.adminSession.deleteMany({
      where: { tokenHash: hashAdminSessionToken(token) },
    });
  } catch (error) {
    void logger.error("Failed to revoke admin session", { operation: "revoke" }, "admin/auth");
    throw error;
  }
}

export function createPendingChallengeToken(secret: string): string {
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes validity
  const payload = `${expiresAt}`;
  const signature = crypto.createHmac("sha256", secret).update(`pending-2fa:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyPendingChallengeToken(token: string | null | undefined, secret: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", secret).update(`pending-2fa:${expiresAtStr}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
}

export async function isAdminAuthorized(request: Request): Promise<boolean> {
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookieHeader(cookieHeader);
  const cookieToken = cookies[ADMIN_COOKIE_NAME]?.trim();

  if (!cookieToken) return false;

  try {
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashAdminSessionToken(cookieToken) },
    });
    return Boolean(session && session.expiresAt.getTime() > Date.now());
  } catch (error) {
    void logger.error("Failed to look up admin session", { operation: "lookup" }, "admin/auth");
    throw error;
  }
}
