/** Upload IDs are public recovery state; upload URLs and their tokens are not. */
export function readImageUploadId(value: unknown): string | undefined {
  return typeof value === 'string' && /^imgup_[A-Za-z0-9_-]{21}$/.test(value)
    ? value
    : undefined
}

/**
 * Retain only the identity and effective brand of an explicit finalization.
 * SDK 13.3 errors and verbatim caller-abort reasons have no upload metadata.
 * Never inspect byte-upload URLs, retain their credentials, or store a body.
 */
export function imageUploadRequestContext(input: {
  readonly method: string
  readonly path: string
  readonly body: unknown
  readonly headers: Headers
}): { readonly uploadId?: string; readonly brandId?: string } {
  if (
    input.method !== 'POST' ||
    input.path.split('?')[0] !== '/v1/content/add-image' ||
    typeof input.body !== 'string'
  ) {
    return {}
  }
  let body: unknown
  try {
    body = JSON.parse(input.body)
  } catch {
    return {}
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    Object.keys(body).length !== 1 ||
    !('uploadId' in body)
  ) {
    return {}
  }
  const uploadId = readImageUploadId(body.uploadId)
  if (uploadId === undefined) return {}
  const brandId = input.headers.get('x-brand-id')
  return { uploadId, ...(brandId === null ? {} : { brandId }) }
}
