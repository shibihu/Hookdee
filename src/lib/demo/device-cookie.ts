import "server-only";



export const DEMO_DEVICE_COOKIE_NAME = "hookdee_demo_device";

async function signature(deviceId: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(deviceId));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqualHex(aHex: string, bHex: string): boolean {
  if (aHex.length !== bHex.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aHex.length; i += 1) {
    result |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  }

  return result === 0;
}

export function createDemoDeviceId(): string {
  return crypto.randomUUID();
}

export async function signDemoDeviceId(
  deviceId: string,
  secret: string,
): Promise<string> {
  const sig = await signature(deviceId, secret);
  return `${deviceId}.${sig}`;
}

export async function readDemoDeviceId(
  signedValue: string | null,
  secret: string,
): Promise<string | null> {
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

  const expectedSignature = await signature(deviceId, secret);
  return constantTimeEqualHex(expectedSignature, suppliedSignature.toLowerCase())
    ? deviceId
    : null;
}

export function serializeDemoDeviceCookie(
  signedValue: string,
  isProduction: boolean,
): string {
  const secure = isProduction ? "; Secure" : "";
  return `${DEMO_DEVICE_COOKIE_NAME}=${encodeURIComponent(signedValue)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}
