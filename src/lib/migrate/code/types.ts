/**
 * What the code scan finds in one file, whichever engine read it (the
 * project's TypeScript compiler, or the built-in tokenizer). Offsets are
 * UTF-16 indexes into the file's text; lines and columns are 1-based.
 */

export type Span = { readonly start: number; readonly end: number }

/** An import of the `resend` package (`import … from 'resend'`, `require('resend')`). */
export type ResendImport = {
  readonly kind: 'esm' | 'require'
  /** The module string, quotes included. */
  readonly specifier: Span
  readonly typeOnly: boolean
  /** Locals bound to the `Resend` class (`Resend`, an alias). */
  readonly ctorNames: readonly string[]
  /** Locals bound to the whole module (`import * as r`, `const r = require(…)`). */
  readonly namespaces: readonly string[]
  /** Every name imported from the module (`Resend`, `CreateEmailOptions`, `default`, `*`). */
  readonly importedNames: readonly string[]
}

/** A binding imported from another file of the project. */
export type LocalImport = {
  readonly local: string
  /** `default`, `*`, or the exported name. */
  readonly imported: string
  readonly from: string
}

/** A `new Resend(…)`. */
export type ClientSite = {
  /** `resend`, `this.mailer`; null for an inline or unnamed client. */
  readonly binding: string | null
  /** The name another file imports it by (`default` for a default export). */
  readonly exportName: string | null
  readonly line: number
  readonly column: number
  /** Inside the parentheses (empty span when there are none). */
  readonly args: Span
  /** True when a send is called on it directly: `new Resend(k).emails.send(…)`. */
  readonly inline: boolean
}

/** A `<receiver>.emails.send(…)` or `<receiver>.batch.send(…)`. */
export type CallLocation = {
  readonly receiver: string
  readonly method: 'emails.send' | 'batch.send'
  readonly line: number
  readonly column: number
  /** The first argument's source span. */
  readonly args: Span
  /** The receiver is a `new Resend(…)` expression. */
  readonly inlineClient: boolean
}

export type FileLocations = {
  readonly imports: readonly ResendImport[]
  readonly localImports: readonly LocalImport[]
  readonly clients: readonly ClientSite[]
  readonly calls: readonly CallLocation[]
  /** Names this file exports, as `local → exported`. */
  readonly exports: ReadonlyArray<{
    readonly local: string
    readonly exported: string
  }>
  /** Where a new import statement goes: after the last import (0 = top). */
  readonly importInsertAt: number
  readonly moduleSyntax: 'esm' | 'cjs'
  /** Relative imports in this file spell a `.js` extension (NodeNext). */
  readonly relativeImportsUseJs: boolean
}

export type ScanEngine = 'typescript' | 'tokenizer'
