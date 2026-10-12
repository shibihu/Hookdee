import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEMO_DEVICE_COOKIE_NAME,
  readDemoDeviceId,
  serializeDemoDeviceCookie,
  signDemoDeviceId,
} from "./device-cookie";

describe("demo device cookie", () => {
  it("verifies a signed device identifier and rejects a modified signature", () => {
    const signedValue = signDemoDeviceId("device-123", "test-secret");

    expect(readDemoDeviceId(signedValue, "test-secret")).toBe("device-123");
    expect(readDemoDeviceId(`${signedValue.slice(0, -1)}0`, "test-secret")).toBe(
      null,
    );
    expect(readDemoDeviceId("malformed", "test-secret")).toBe(null);
  });

  it("serializes a secure HttpOnly same-site cookie for production", () => {
    const cookie = serializeDemoDeviceCookie(
      signDemoDeviceId("device-123", "test-secret"),
      true,
    );

    expect(cookie).toContain(`${DEMO_DEVICE_COOKIE_NAME}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
  });
});
