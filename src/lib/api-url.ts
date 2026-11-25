import { CliUsageError } from './errors'

export const DEFAULT_API_URL = 'https://brew.new/api'

export function apiOrigin(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new CliUsageError(
      'The API URL must be an absolute HTTP or HTTPS URL.'
    )
  }
  const isLoopback =
    url.hostname === 'localhost' ||
    url.hostname === '[::1]' ||
    /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback))
  ) {
    throw new CliUsageError(
      'The API URL must use HTTPS or loopback HTTP without URL credentials.'
    )
  }
  return url.origin
}
