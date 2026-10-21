export function databaseConfig(value: string | undefined): { connectionString?: string; issue?: 'missing_database_url' | 'invalid_database_url' } {
  if (!value?.trim()) return { issue: 'missing_database_url' };
  try {
    const url = new URL(value.trim());
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length < 2) return { issue: 'invalid_database_url' };
    url.searchParams.set('sslmode', 'verify-full');
    return { connectionString: url.toString() };
  } catch { return { issue: 'invalid_database_url' }; }
}
