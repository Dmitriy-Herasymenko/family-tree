export function isAllowedOrigin(origin: string | undefined, configuredOrigin: string, production: boolean): boolean {
  if (!origin) return false;
  try {
    const actual = new URL(origin), expected = new URL(configuredOrigin);
    if (actual.origin === expected.origin) return true;
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return !production && loopback.has(actual.hostname) && loopback.has(expected.hostname) && actual.protocol === expected.protocol && actual.port === expected.port;
  } catch { return false; }
}

export function allowedAppOrigins(env: Record<string, string | undefined>): string[] {
  const origins: string[] = [];
  if (env.APP_ORIGIN) origins.push(env.APP_ORIGIN);
  if (env.VERCEL === '1') {
    for (const host of [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (host && !/[\s/]/.test(host)) origins.push(`https://${host}`);
    }
  }
  if (!origins.length && env.VERCEL !== '1' && env.NODE_ENV !== 'production') origins.push('http://localhost:5173');
  return [...new Set(origins)];
}
