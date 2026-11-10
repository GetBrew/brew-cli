import type { Readable } from 'node:stream'
import { decodeUtf8Text, type TextKind } from './utf8'

/**
 * Read through EOF as UTF-8, refusing bytes that are not; an interrupted or
 * timed-out command closes its input.
 */
export async function readStdinText({
  stream,
  signal,
  kind,
}: {
  readonly stream: Readable
  readonly signal: AbortSignal
  readonly kind?: TextKind | undefined
}): Promise<string> {
  if (signal.aborted) {
    stream.destroy()
    signal.throwIfAborted()
  }
  const stop = (): void => {
    stream.destroy()
  }
  signal.addEventListener('abort', stop, { once: true })
  const chunks: Buffer[] = []
  try {
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
    }
  } catch (error) {
    if (!signal.aborted) {
      throw error
    }
  } finally {
    signal.removeEventListener('abort', stop)
  }
  signal.throwIfAborted()
  return decodeUtf8Text(Buffer.concat(chunks), 'stdin', { kind })
}
