import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const DEMO_DEVICE_COOKIE_NAME = "hookdee_demo_device";

function signature(deviceId: string, secret: string): string {
  return createHmac("sha256", secret).update(deviceId).digest("hex");
}

export function createDemoDeviceId(): string {
  return randomUUID();
}

export function signDemoDeviceId(deviceId: string, secret: string): string {
  return `${deviceId}.${signature(deviceId, secret)}`;
}

export function readDemoDeviceId(
  signedValue: string | null,
  secret: string,
): string | null {
  if (!signedValue) {
    return null;
  }

  const separator = signedValue.lastIndexOf(".");
  if (separator <= 0) {
    return null;
  }

  const deviceId = signedValue.slice(0, separator);
  const suppliedSignature = signedValue.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/i.test(suppliedSignature)) {
    return null;
  }

  const expected = Buffer.from(signature(deviceId, secret), "hex");
  const supplied = Buffer.from(suppliedSignature, "hex");
  return timingSafeEqual(expected, supplied) ? deviceId : null;
}

export function serializeDemoDeviceCookie(
  signedValue: string,
  isProduction: boolean,
): string {
  const secure = isProduction ? "; Secure" : "";
  return `${DEMO_DEVICE_COOKIE_NAME}=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}
