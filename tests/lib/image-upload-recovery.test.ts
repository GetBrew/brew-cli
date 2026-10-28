import { describe, expect, it } from 'vitest'
import { imageUploadRequestContext } from '../../src/lib/image-upload-recovery'

const UPLOAD_ID = 'imgup_V1StGXR8_Z5jdHi6B-myT'
const request = {
  method: 'POST',
  path: '/v1/content/add-image',
  body: JSON.stringify({ uploadId: UPLOAD_ID }),
  headers: new Headers({ 'x-brand-id': 'brand_one' }),
}

describe('image upload recorder recovery state', () => {
  it('retains only the original upload ID and effective brand', () => {
    expect(imageUploadRequestContext(request)).toEqual({
      uploadId: UPLOAD_ID,
      brandId: 'brand_one',
    })
  })

  it.each([
    { path: `/uploads/brand-image?uploadId=${UPLOAD_ID}&token=private` },
    { path: '/v1/content/image-uploads' },
    { path: '/v1/contacts' },
    { method: 'GET' },
    { body: JSON.stringify({ imageUrl: 'https://image.test/logo.png' }) },
    { body: JSON.stringify({ imageUrls: ['https://image.test/logo.png'] }) },
    { body: JSON.stringify({ uploadId: 'private-token' }) },
    { body: JSON.stringify({ uploadId: UPLOAD_ID, token: 'private' }) },
    { body: JSON.stringify([UPLOAD_ID]) },
    { body: '{broken' },
    { body: undefined },
  ])(
    'ignores a request that cannot safely name finalization: %j',
    (changes) => {
      expect(imageUploadRequestContext({ ...request, ...changes })).toEqual({})
    }
  )
})
