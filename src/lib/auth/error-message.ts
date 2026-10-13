import { th } from "@/lib/i18n/th";

const authErrorMessages: Record<string, string> = {
  Configuration: th.login.authErrors.configuration,
  OAuthSignin: th.login.authErrors.oauthSignin,
  OAuthCallbackError: th.login.authErrors.oauthCallback,
  OAuthAccountNotLinked: th.login.authErrors.accountNotLinked,
  AccessDenied: th.login.authErrors.accessDenied,
};

export function errorMessageForAuth(
  error: string | string[] | undefined,
): string | null {
  if (error === undefined) {
    return null;
  }

  if (typeof error !== "string") {
    return th.login.authErrors.unknown;
  }

  return authErrorMessages[error] ?? th.login.authErrors.unknown;
}
