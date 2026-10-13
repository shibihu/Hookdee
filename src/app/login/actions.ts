"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { safeReturnTo } from "@/lib/auth/return-to";
import { getServerEnv } from "@/lib/env.server";

function isRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT;")
  );
}

function errorTypeForLog(error: unknown): string {
  if (error instanceof AuthError) {
    return error.type;
  }

  return error instanceof Error ? error.name : "UnknownError";
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const env = getServerEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    console.error("Google sign-in unavailable: provider is not configured");
    redirect("/login?error=Configuration");
  }

  const value = formData.get("returnTo");
  const returnTo = safeReturnTo(
    typeof value === "string" ? value : undefined,
    env.APP_URL,
  );

  try {
    await signIn("google", { redirectTo: returnTo });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("Google sign-in action failed", errorTypeForLog(error));
    const code = error instanceof AuthError ? error.type : "SignInFailed";
    redirect(`/login?error=${encodeURIComponent(code)}`);
  }
}

export async function signOutOfAccount(): Promise<void> {
  try {
    await signOut({ redirectTo: "/" });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    console.error("Sign-out action failed", errorTypeForLog(error));
    redirect("/login?error=SignOutFailed");
  }
}
