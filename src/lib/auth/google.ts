import "server-only";

export const USER_SESSION_COOKIE = "hookdee_user_session";

export interface GoogleUserProfile {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export function getGoogleAuthUrl(clientId: string, redirectUri: string, state?: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  if (state) {
    url.searchParams.set("state", state);
  }
  return url.toString();
}

export async function exchangeGoogleCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ access_token: string; id_token?: string; refresh_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange Google OAuth code: ${errText}`);
  }

  return res.json();
}

export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch Google user profile");
  }

  const data = await res.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}
