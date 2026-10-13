import { describe, expect, it } from "vitest";
import { errorMessageForAuth } from "./error-message";
import { th } from "@/lib/i18n/th";

describe("errorMessageForAuth", () => {
  it.each([
    ["Configuration", th.login.authErrors.configuration],
    ["OAuthSignin", th.login.authErrors.oauthSignin],
    ["OAuthCallbackError", th.login.authErrors.oauthCallback],
    ["CallbackRouteError", th.login.authErrors.oauthCallback],
    ["OAuthAccountNotLinked", th.login.authErrors.accountNotLinked],
    ["AccessDenied", th.login.authErrors.accessDenied],
  ])("returns friendly recovery guidance for %s", (error, expected) => {
    const message = errorMessageForAuth(error);

    expect(message).toBe(expected);
    expect(message).not.toContain(error);
  });

  it("uses generic retry guidance for unknown error values", () => {
    expect(errorMessageForAuth("provider-secret-and-token")).toBe(
      th.login.authErrors.unknown,
    );
    expect(errorMessageForAuth(["OAuthSignin", "provider-secret"])).toBe(
      th.login.authErrors.unknown,
    );
  });

  it.each(["constructor", "toString", "__proto__"])(
    "does not treat inherited object keys as allowlisted error codes: %s",
    (error) => {
      expect(errorMessageForAuth(error)).toBe(th.login.authErrors.unknown);
    },
  );

  it("returns no message when there is no error", () => {
    expect(errorMessageForAuth(undefined)).toBeNull();
  });
});
