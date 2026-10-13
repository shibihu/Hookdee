export function safeReturnTo(
  value: string | string[] | undefined,
  appUrl: string,
): string {
  if (typeof value !== "string") {
    return "/";
  }

  try {
    const app = new URL(appUrl);
    const target = new URL(value, app);
    if (target.origin !== app.origin) {
      return "/";
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
