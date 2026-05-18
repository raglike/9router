export function normalizeCustomActionPath(value) {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed, "https://capability-marketplace.local");
    const pathname = parsed.pathname?.trim() || "/";
    const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
    return `${normalizedPathname}${parsed.search}`;
  } catch {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
}

export function applyCustomActionOverride(url, providerSpecificData = null) {
  const customActionPath = normalizeCustomActionPath(providerSpecificData?.customActionPath);

  if (providerSpecificData?.customActionEnabled !== true || !customActionPath) {
    return url;
  }

  try {
    const targetUrl = new URL(url);
    const overrideUrl = new URL(customActionPath, targetUrl.origin);

    targetUrl.pathname = overrideUrl.pathname;
    targetUrl.search = overrideUrl.search;

    return targetUrl.toString();
  } catch {
    return url;
  }
}
