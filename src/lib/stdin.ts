import type { Readable } from 'node:stream'

/** Read through EOF; an interrupted or timed-out command closes its input. */
export async function readStdinText({
  stream,
  signal,
}: {
  readonly stream: Readable
  readonly signal: AbortSignal
}): Promise<string> {
  if (signal.aborted) {
    stream.destroy()
    signal.throwIfAborted()
  }
  const stop = (): void => {
    stream.destroy()
  }
  signal.addEventListener('abort', stop, { once: true })
  stream.setEncoding('utf8')
  let text = ''
  try {
    for await (const chunk of stream) {
      text += String(chunk)
    }
  } catch (error) {
    if (!signal.aborted) {
      throw error
    }
  } finally {
    signal.removeEventListener('abort', stop)
  }
  signal.throwIfAborted()
  return text
}
