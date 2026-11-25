function shebangWords(source) {
  const words = []
  let word = ''
  let quote
  let hasWord = false
  for (let cursor = 0; cursor < source.length; cursor++) {
    const character = source[cursor]
    if (character === '\\' && quote !== "'") {
      if (++cursor === source.length) {
        throw new Error('Unterminated shebang escape')
      }
      word += source[cursor]
      hasWord = true
    } else if (quote) {
      if (character === quote) {
        quote = undefined
      } else {
        word += character
      }
    } else if (character === '"' || character === "'") {
      quote = character
      hasWord = true
    } else if (/[ \t]/.test(character)) {
      if (hasWord) {
        words.push(word)
        word = ''
        hasWord = false
      }
    } else {
      word += character
      hasWord = true
    }
  }
  if (quote) {
    throw new Error('Unterminated shebang quote')
  }
  if (hasWord) {
    words.push(word)
  }
  return words
}

export function shebangLanguage(source) {
  const header = source.match(/^#![ \t]*([^\r\n]+)/)?.[1]
  if (!header) {
    return
  }
  const words = shebangWords(header)
  let command = words.shift()?.split('/').at(-1)
  if (command === 'env') {
    command = undefined
    while (words.length > 0) {
      const word = words.shift()
      const splitString = /^--split-string=(.*)$|^-S(.+)$/.exec(word)
      if (splitString) {
        words.unshift(...shebangWords(splitString[1] ?? splitString[2]))
      } else if (['-u', '--unset', '-C', '--chdir'].includes(word)) {
        words.shift()
      } else if (!word.startsWith('-') && !/^[A-Za-z_]\w*=/.test(word)) {
        command = word.split('/').at(-1)
        break
      }
    }
  }
  if (/^(?:python(?:\d+(?:\.\d+)*)?|pypy\d*)$/.test(command)) {
    return 'python'
  }
  if (/^(?:bash|sh|dash|zsh|ksh)$/.test(command)) {
    return 'bash'
  }
  if (/^(?:node|nodejs|bun|deno)$/.test(command)) {
    return 'javascript'
  }
}

export function dotenvCommentRanges(source) {
  const comments = []
  let cursor = 0
  while (cursor < source.length) {
    const lineEnd = source.slice(cursor).search(/[\r\n]/)
    const end = lineEnd === -1 ? source.length : cursor + lineEnd
    const line = source.slice(cursor, end)
    const standalone = line.match(/^[ \t]*(#.*)$/)
    if (standalone) {
      comments.push({ pos: cursor + line.indexOf('#'), end })
      cursor = end + 1
      continue
    }
    const assignment = line.match(
      /^[ \t]*(?:export[ \t]+)?[\w.-]+(?:[ \t]*=[ \t]*|:[ \t]+)/
    )
    if (!assignment) {
      cursor = end + 1
      continue
    }
    cursor += assignment[0].length
    const quote = source[cursor]
    if (quote === '"' || quote === "'" || quote === '`') {
      cursor++
      let isClosed = false
      while (cursor < source.length) {
        if (source[cursor] === '\\' && source[cursor + 1] === quote) {
          cursor += 2
        } else if (source[cursor++] === quote) {
          isClosed = true
          break
        }
      }
      if (!isClosed) {
        throw new Error('Unterminated dotenv value')
      }
    }
    while (cursor < source.length && !/[\r\n]/.test(source[cursor])) {
      if (source[cursor] === '#') {
        const pos = cursor
        while (cursor < source.length && !/[\r\n]/.test(source[cursor])) {
          cursor++
        }
        comments.push({ pos, end: cursor })
        break
      }
      cursor++
    }
    cursor++
  }
  return comments
}
