import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { getServerEnv } from "@/lib/env.server";
import { th } from "@/lib/i18n/th";
import LoginPage from "./page";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/env.server", () => ({ getServerEnv: vi.fn() }));
vi.mock("./actions", () => ({
  signInWithGoogle: vi.fn(),
  signOutOfAccount: vi.fn(),
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockGetServerEnv = getServerEnv as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue(null);
  mockGetServerEnv.mockReturnValue({
    APP_URL: "https://hookdee.example",
    GOOGLE_CLIENT_ID: "google-client-id",
    GOOGLE_CLIENT_SECRET: "google-client-secret",
  } as ReturnType<typeof getServerEnv>);
});

async function renderLoginPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  return renderToStaticMarkup(
    await LoginPage({ searchParams: Promise.resolve(searchParams) }),
  );
}

describe("LoginPage", () => {
  it("renders a Google sign-in form and rejects an external return target", async () => {
    const html = await renderLoginPage({
      returnTo: "https://attacker.example/callback?token=private",
    });

    expect(html).toContain(th.login.googleSignIn);
    expect(html).toContain('name="returnTo" value="/"');
    expect(html).not.toContain("attacker.example");
  });

  it("shows the signed-in account and sign-out action", async () => {
    mockAuth.mockResolvedValue({
      user: {
        name: "Mali",
        email: "mali@example.com",
      },
      expires: "2030-01-01T00:00:00.000Z",
    });

    const html = await renderLoginPage();

    expect(html).toContain("Mali");
    expect(html).toContain("mali@example.com");
    expect(html).toContain(th.login.signOut);
    expect(html).not.toContain(th.login.googleSignIn);
  });

  it("explains when Google sign-in is unavailable", async () => {
    mockGetServerEnv.mockReturnValue({
      APP_URL: "https://hookdee.example",
    } as ReturnType<typeof getServerEnv>);

    const html = await renderLoginPage();

    expect(html).toContain(th.login.googleUnavailable);
    expect(html).not.toContain('name="returnTo"');
  });

  it("shows allowlisted failure guidance without exposing unknown error values", async () => {
    const knownErrorHtml = await renderLoginPage({
      error: "OAuthCallbackError",
    });
    const unknownValue = "raw-provider-error-token";
    const unknownErrorHtml = await renderLoginPage({ error: unknownValue });

    expect(knownErrorHtml).toContain(th.login.authErrors.oauthCallback);
    expect(unknownErrorHtml).toContain(th.login.authErrors.unknown);
    expect(unknownErrorHtml).not.toContain(unknownValue);
  });
});
