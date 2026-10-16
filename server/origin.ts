export function isAllowedOrigin(origin: string | undefined, configuredOrigin: string, production: boolean): boolean {
  if (!origin) return false;
  try {
    const actual = new URL(origin), expected = new URL(configuredOrigin);
    if (actual.origin === expected.origin) return true;
    const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
    return !production && loopback.has(actual.hostname) && loopback.has(expected.hostname) && actual.protocol === expected.protocol && actual.port === expected.port;
  } catch { return false; }
}
