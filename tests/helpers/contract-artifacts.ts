import { HttpResponse, http } from 'msw'

/**
 * `GET /v1/automations/triggers/{id}/contract?format=ts` for test trigger
 * rows: the TypeScript artifact the platform serves (one exported payload
 * type named after the trigger title), built from the row's declared
 * scalar fields so `types` and `init` see a realistic contract.
 */

type FieldRow = {
  readonly key: string
  readonly type: string
  readonly required?: boolean
}

export type ContractRow = {
  readonly triggerEventId: string
  readonly title: string
  readonly payloadSchema?: { readonly fields?: ReadonlyArray<FieldRow> }
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function typeNameOf(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  return `${words.join('') || 'Trigger'}Payload`
}

function scalar(type: string): string {
  if (type === 'int' || type === 'float' || type === 'number') {
    return 'number'
  }
  if (type === 'boolean') {
    return 'boolean'
  }
  return 'string'
}

export function contractArtifact(row: ContractRow): {
  readonly typeName: string
  readonly content: string
} {
  const typeName = typeNameOf(row.title)
  const fields = (row.payloadSchema?.fields ?? []).map(
    (field) =>
      `  ${IDENTIFIER_RE.test(field.key) ? field.key : JSON.stringify(field.key)}${field.required === true ? '' : '?'}: ${scalar(field.type)}`
  )
  return {
    typeName,
    content: [
      `/** Fire: POST /v1/automations/triggers/${row.triggerEventId}/fire — body { payload: ${typeName} } */`,
      `export type ${typeName} = {`,
      ...fields,
      '}',
      '',
    ].join('\n'),
  }
}

export function contractHandler(
  api: string,
  rows: () => ReadonlyArray<ContractRow>
) {
  return http.get(
    `${api}/v1/automations/triggers/:triggerEventId/contract`,
    ({ params }) => {
      const row = rows().find(
        (candidate) => candidate.triggerEventId === params.triggerEventId
      )
      if (row === undefined) {
        return HttpResponse.json(
          { error: { code: 'TRIGGER_EVENT_NOT_FOUND', type: 'not_found' } },
          { status: 404 }
        )
      }
      const artifact = contractArtifact(row)
      return HttpResponse.json({
        format: 'ts',
        typeName: artifact.typeName,
        subjectKind: 'trigger',
        subjectId: row.triggerEventId,
        source: 'stored',
        content: artifact.content,
      })
    }
  )
}
