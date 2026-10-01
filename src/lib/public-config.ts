export function publicConfigurationError(
  url?: string,
  key?: string,
): string | null {
  if (!url || !key)
    return 'The showcase connection is not configured. Contact your administrator.'
  try {
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' &&
      !(
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname)
      )
    )
      return 'Use a secure HTTPS showcase connection.'
    if (key.startsWith('sb_secret_'))
      return 'Only a public publishable key may be used by this application.'
    if (key.split('.').length === 3) {
      const role = JSON.parse(
        atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      ).role
      if (role !== 'anon')
        return 'Only a public publishable key may be used by this application.'
    }
    return null
  } catch {
    return 'The public showcase configuration is invalid. Contact your administrator.'
  }
}
