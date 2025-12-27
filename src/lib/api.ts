// src/lib/api.ts
// Prefer configured host, but avoid mixed-content and localhost leaks in production.
const configuredHost = process.env.NEXT_PUBLIC_API_URL?.trim();
const vercelHost = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

function isLocalHost(url: string | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function resolveApiHost() {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!configuredHost) return origin;

    const configuredIsLocal = isLocalHost(configuredHost);
    const originIsHttps = origin.startsWith('https://');
    const configuredIsHttp = configuredHost.startsWith('http://');

    // If the page is https but API host is http, prefer same-origin to avoid mixed-content failures.
    if (originIsHttps && configuredIsHttp) return origin;
    // If env points to localhost but we are on a non-localhost origin, use the current origin.
    if (configuredIsLocal && !isLocalHost(origin)) return origin;

    return configuredHost;
  }

  // Server-side: favor explicit config, then deployment host, finally local dev.
  return configuredHost || vercelHost || 'http://localhost:3000';
}

const API_HOST = resolveApiHost();

// Backend public routes are mounted under /api/public/* in the server. If we do not have an
// absolute host, keep the path relative so it works in serverless environments.
const PUBLIC_BASE = API_HOST ? `${API_HOST}/api/public` : `/api/public`;

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 60 * 1000; // 60 seconds

function getCached(key: string): any | null {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

async function safeJson(res: Response) {
  let json: any = null;
  try {
    json = await res.json();
  } catch (err) {
    return null;
  }
  return json;
}

function normalizeArrayResponse(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json?.articles)) return json.articles;
  if (Array.isArray(json?.data?.articles)) return json.data.articles;

  if (json.success && Array.isArray(json.data)) return json.data;
  
  return [];
}

export async function fetchCategoryBySlug(slug: string) {
  const res = await fetch(`${API_HOST}/api/categories/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch category");
  const json = await res.json();
  return json; // backend returns { success, category, articles }
}


export async function fetchCategories() {
  const cacheKey = 'categories';
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const res = await fetch(`${API_HOST}/api/categories`, { cache: "no-store" });
  const json = await safeJson(res);
  const result = normalizeArrayResponse(json);
  setCache(cacheKey, result);
  return result;
}

/**
 * fetchArticles(options)
 * options: { limit?: number, category?: string, categoryKey?: string, page?: number, q?: string, lang?: string }
 * Returns an array (possibly empty).
 */
export async function fetchArticles(options?: Record<string, any>) {
  // Backend endpoint: GET /api/public/articles with optional query params
  const url = new URL(`${PUBLIC_BASE}/articles`);
  if (options) {
    Object.entries(options).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  
  const cacheKey = url.toString();
  const cached = getCached(cacheKey);
  if (cached) return cached;
  
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = await safeJson(res);
  const result = normalizeArrayResponse(json);
  setCache(cacheKey, result);
  return result;
}

export async function fetchArticleBySlug(slug: string) {
  if (!slug) throw new Error("Missing slug");
  // Backend endpoint: GET /api/public/articles/:slug
  const res = await fetch(`${PUBLIC_BASE}/articles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  const json = await safeJson(res);
  return json?.data ?? json;
}

export async function fetchTrending() {
  const res = await fetch(`${API_HOST}/api/trending`, { cache: "no-store" });
  const json = await safeJson(res);
  return json ?? {};
}

export async function fetchActiveTickers() {
  const res = await fetch(`${API_HOST}/api/ticker/active`, { cache: "no-store" });
  const json = await safeJson(res);
  return json?.data ?? json ?? [];
}
