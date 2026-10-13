import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

const appUrl = "https://hookdee.example";

describe("safeReturnTo", () => {
  it("preserves a local path, query, and hash", () => {
    expect(safeReturnTo("/projects?view=recent#top", appUrl)).toBe(
      "/projects?view=recent#top",
    );
  });

  it("reduces a same-origin absolute URL to its path, query, and hash", () => {
    expect(
      safeReturnTo("https://hookdee.example/projects?view=recent#top", appUrl),
    ).toBe("/projects?view=recent#top");
  });

  it("rejects a foreign absolute URL", () => {
    expect(safeReturnTo("https://evil.example/path?x=1#top", appUrl)).toBe("/");
  });

  it("rejects a protocol-relative foreign URL", () => {
    expect(safeReturnTo("//evil.example/path", appUrl)).toBe("/");
  });

  it("rejects an array value", () => {
    expect(safeReturnTo(["/first", "/second"], appUrl)).toBe("/");
  });

  it("rejects missing or malformed values", () => {
    expect(safeReturnTo(undefined, appUrl)).toBe("/");
    expect(safeReturnTo("http://[invalid", appUrl)).toBe("/");
  });
});
