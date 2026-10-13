import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env.server";
import { getGoogleAuthUrl } from "@/lib/auth/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let appUrl = process.env.APP_URL || "http://localhost:3000";

  try {
    const env = getServerEnv();
    clientId = env.GOOGLE_CLIENT_ID || clientId;
    appUrl = env.APP_URL || appUrl;
  } catch {
    // fallback to env vars
  }

  if (!clientId) {
    return NextResponse.json(
      {
        code: "GOOGLE_OAUTH_NOT_CONFIGURED",
        message: "GOOGLE_CLIENT_ID is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
      },
      { status: 500 }
    );
  }

  const origin = new URL(request.url).origin || appUrl;
  const redirectUri = `${origin}/api/auth/callback/google`;
  const authUrl = getGoogleAuthUrl(clientId, redirectUri);

  return NextResponse.redirect(authUrl);
}
