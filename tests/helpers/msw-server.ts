import { setupServer } from 'msw/node'

/** Shared MSW server; tests register handlers per-case with server.use(). */
export const server = setupServer()
