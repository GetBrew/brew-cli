export function gritCommentRanges(source) {
  const comments = []
  let cursor = 0
  while (cursor < source.length) {
    const quote = source[cursor]
    if (quote === '"' || quote === "'" || quote === '`') {
      const start = cursor++
      let isClosed = false
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor += 2
        } else if (source[cursor] === quote) {
          cursor++
          isClosed = true
          break
        } else if (quote !== '`' && /[\r\n]/.test(source[cursor])) {
          break
        } else {
          cursor++
        }
      }
      if (!isClosed) {
        throw new Error(`Unterminated GritQL literal at offset ${start}`)
      }
    } else if (source.startsWith('//', cursor)) {
      const pos = cursor
      while (cursor < source.length && !/[\r\n]/.test(source[cursor])) {
        cursor++
      }
      comments.push({ pos, end: cursor })
    } else if (source.startsWith('/*', cursor)) {
      const pos = cursor
      const end = source.indexOf('*/', cursor + 2)
      if (end === -1) {
        throw new Error(`Unterminated GritQL comment at offset ${pos}`)
      }
      cursor = end + 2
      comments.push({ pos, end: cursor })
    } else {
      cursor++
    }
  }
  return comments
}
