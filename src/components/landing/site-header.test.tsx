import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/auth";
import { th } from "@/lib/i18n/th";
import { SiteHeader } from "./site-header";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/app/login/actions", () => ({ signOutOfAccount: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockAuth.mockResolvedValue(null);
});

describe("SiteHeader", () => {
  it("shows the sign-in link when no account is signed in", async () => {
    const html = renderToStaticMarkup(await SiteHeader());

    expect(html).toContain(th.nav.signIn);
    expect(html).toContain('href="/login"');
    expect(html).not.toContain(th.nav.signOut);
    expect(html).toContain('href="#how-it-works"');
    expect(html).toContain('href="#pricing"');
    expect(html).toContain('href="#faq"');
  });

  it("shows account identity and sign-out when signed in", async () => {
    mockAuth.mockResolvedValue({
      user: {
        name: "Mali",
        email: "mali@example.com",
      },
      expires: "2030-01-01T00:00:00.000Z",
    });

    const html = renderToStaticMarkup(await SiteHeader());

    expect(html).toContain("Mali");
    expect(html).toContain(th.nav.signOut);
    expect(html).not.toContain('href="/login"');
  });
});
