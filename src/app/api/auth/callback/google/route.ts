import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env.server";
import { exchangeGoogleCodeForToken, fetchGoogleUserProfile, USER_SESSION_COOKIE } from "@/lib/auth/google";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam || !code) {
    void logger.warn("Google OAuth callback error or missing code", { errorParam }, "auth/google/callback");
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
  }

  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let appUrl = process.env.APP_URL || "http://localhost:3000";

  try {
    const env = getServerEnv();
    clientId = env.GOOGLE_CLIENT_ID || clientId;
    clientSecret = env.GOOGLE_CLIENT_SECRET || clientSecret;
    appUrl = env.APP_URL || appUrl;
  } catch {
    // fallback
  }

  if (!clientId || !clientSecret) {
    void logger.error("Google OAuth credentials missing during callback", {}, "auth/google/callback");
    return NextResponse.redirect(new URL("/login?error=missing_credentials", request.url));
  }

  try {
    const origin = url.origin || appUrl;
    const redirectUri = `${origin}/api/auth/callback/google`;

    const tokens = await exchangeGoogleCodeForToken(code, clientId, clientSecret, redirectUri);
    const googleProfile = await fetchGoogleUserProfile(tokens.access_token);

    // Upsert User and Account in DB
    let user = await prisma.user.findUnique({ where: { email: googleProfile.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: googleProfile.email,
          name: googleProfile.name || googleProfile.email.split("@")[0],
          image: googleProfile.picture,
          emailVerified: new Date(),
        },
      });
    }

    // Connect Account
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: googleProfile.id,
        },
      },
      create: {
        userId: user.id,
        type: "oauth",
        provider: "google",
        providerAccountId: googleProfile.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
      },
    });

    // Create Session
    const sessionToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    void logger.info("User logged in with Google OAuth", { userId: user.id, email: user.email }, "auth/google/callback");

    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set(USER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires,
    });

    return response;
  } catch (error) {
    void logger.error("Failed Google OAuth authentication callback", { error: String(error) }, "auth/google/callback");
    return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
  }
}
